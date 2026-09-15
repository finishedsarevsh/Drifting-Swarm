"""
delta_codec.py
Sparsify + quantize + Ed25519-sign ΔW (model weight delta) packages,
and verify + apply incoming ΔW packages.

Phase 1 uses local filesystem keys (keys/<NODE_ID>_private.pem,
keys/public_registry.json).  In Phase 2 this is replaced by AWS KMS
with the same sign/verify call signatures — no application code changes.
"""

import json
import logging
import pickle
import time
import zlib
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import (
        Ed25519PrivateKey,
        Ed25519PublicKey,
    )
    from cryptography.hazmat.primitives.serialization import (
        Encoding,
        NoEncryption,
        PrivateFormat,
        PublicFormat,
        load_pem_private_key,
        load_pem_public_key,
    )
    from cryptography.exceptions import InvalidSignature
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    logging.warning("cryptography package not installed – signatures will be SKIPPED (dev mode only)")

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Key management helpers
# ------------------------------------------------------------------

def _private_key_path(keys_dir: Path, node_id: str) -> Path:
    return keys_dir / f"{node_id}_private.pem"

def _public_registry_path(keys_dir: Path) -> Path:
    return keys_dir / "public_registry.json"


def generate_keypair(keys_dir: Path, node_id: str) -> None:
    """Generate and save an Ed25519 keypair if not already present."""
    if not CRYPTO_AVAILABLE:
        logger.warning("cryptography not installed – skipping key generation")
        return

    priv_path = _private_key_path(keys_dir, node_id)
    reg_path = _public_registry_path(keys_dir)

    if priv_path.exists():
        logger.debug("[%s] Keypair already exists", node_id)
        return

    keys_dir.mkdir(parents=True, exist_ok=True)
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()

    # Persist private key
    priv_bytes = private_key.private_bytes(
        encoding=Encoding.PEM,
        format=PrivateFormat.PKCS8,
        encryption_algorithm=NoEncryption(),
    )
    priv_path.write_bytes(priv_bytes)
    logger.info("[%s] Private key written to %s", node_id, priv_path)

    # Update public registry (JSON: {node_id: pem_string})
    registry: Dict[str, str] = {}
    if reg_path.exists():
        registry = json.loads(reg_path.read_text())

    pub_bytes = public_key.public_bytes(encoding=Encoding.PEM, format=PublicFormat.SubjectPublicKeyInfo)
    registry[node_id] = pub_bytes.decode()
    reg_path.write_text(json.dumps(registry, indent=2))
    logger.info("Public registry updated: %s", reg_path)


def _load_private_key(keys_dir: Path, node_id: str) -> Optional[Any]:
    if not CRYPTO_AVAILABLE:
        return None
    priv_path = _private_key_path(keys_dir, node_id)
    if not priv_path.exists():
        logger.error("[%s] Private key not found at %s", node_id, priv_path)
        return None
    return load_pem_private_key(priv_path.read_bytes(), password=None)


def _load_public_key(keys_dir: Path, sender_node_id: str) -> Optional[Any]:
    if not CRYPTO_AVAILABLE:
        return None
    reg_path = _public_registry_path(keys_dir)
    if not reg_path.exists():
        logger.error("Public key registry not found at %s", reg_path)
        return None
    registry = json.loads(reg_path.read_text())
    pem = registry.get(sender_node_id)
    if not pem:
        logger.error("No public key for node %s in registry", sender_node_id)
        return None
    return load_pem_public_key(pem.encode())


# ------------------------------------------------------------------
# Public API
# ------------------------------------------------------------------

class DeltaCodec:
    """
    Encode (compress + sign) and decode (verify + load) model packages.
    
    Instead of naive array math on bytes, we compress the entire tree ensemble.
    Since trees are bounded (MAX_TOTAL_TREES), the compressed payload stays
    very small (< 5 MB) and accurately preserves the ensemble structure.

    Package format (JSON-serialisable dict):
    {
        "node_id":   str,
        "epoch":     str,
        "timestamp": float,
        "n_trees":   int,
        "model_bytes": hex_string, # zlib compressed pickle
        "signature": hex_string,
    }
    """

    def __init__(self, node_id: str, keys_dir: str):
        self.node_id = node_id
        self.keys_dir = Path(keys_dir)

    # ------------------------------------------------------------------
    def encode(self, model: Any, epoch: str) -> Dict:
        """
        Build a signed model package from the current model.
        """
        if model is None:
            raise ValueError("Cannot encode None model")

        try:
            raw_bytes = pickle.dumps(model)
            comp_bytes = zlib.compress(raw_bytes)
        except Exception as exc:
            logger.error("[%s] Model serialization failed: %s", self.node_id, exc)
            raise

        n_trees = getattr(model, "n_estimators_", 0)
        
        payload = {
            "node_id": self.node_id,
            "epoch": epoch,
            "timestamp": time.time(),
            "n_trees": n_trees,
            "model_bytes": comp_bytes.hex(),
        }

        # sign
        payload_bytes = json.dumps(payload, sort_keys=True).encode()
        private_key = _load_private_key(self.keys_dir, self.node_id)
        if private_key is not None:
            sig = private_key.sign(payload_bytes)
            payload["signature"] = sig.hex()
        else:
            payload["signature"] = ""

        logger.info(
            "[%s] Model encoded: %d trees, %d bytes compressed (was %d bytes)",
            self.node_id, n_trees, len(comp_bytes), len(raw_bytes)
        )
        return payload

    # ------------------------------------------------------------------
    def verify_and_apply(
        self,
        package: Dict,
        current_model: Any,
    ) -> Tuple[bool, Optional[Any]]:
        """
        Verify signature and load model from package.

        Returns
        -------
        (ok, updated_model)
            ok            : False if signature invalid or schema mismatch
            updated_model : model decompressed from package, or None if failed
        """
        sender = package.get("node_id", "")
        signature_hex = package.get("signature", "")
        payload_for_verify = {k: v for k, v in package.items() if k != "signature"}
        payload_bytes = json.dumps(payload_for_verify, sort_keys=True).encode()

        if signature_hex and CRYPTO_AVAILABLE:
            public_key = _load_public_key(self.keys_dir, sender)
            if public_key is None:
                logger.error("Cannot verify package from %s – public key missing", sender)
                return False, None
            try:
                public_key.verify(bytes.fromhex(signature_hex), payload_bytes)
                logger.debug("[%s] Signature verified for package from %s", self.node_id, sender)
            except InvalidSignature:
                logger.error("[%s] INVALID SIGNATURE on package from %s – rejecting", self.node_id, sender)
                return False, None
        else:
            logger.warning("[%s] No signature / crypto unavailable – accepting package without verification", self.node_id)

        try:
            comp_bytes = bytes.fromhex(package["model_bytes"])
            raw_bytes = zlib.decompress(comp_bytes)
            updated_model = pickle.loads(raw_bytes)
            
            # Simple schema validation (prevent 20-feat model from poisoning 15-feat swarm)
            if current_model is not None:
                curr_feat = getattr(current_model, "n_features_in_", None)
                new_feat = getattr(updated_model, "n_features_in_", None)
                if curr_feat is not None and new_feat is not None and curr_feat != new_feat:
                    logger.error(
                        "[%s] Schema mismatch: local model has %d features but incoming "
                        "model expects %d features (sender=%s, epoch=%s). "
                        "Rejecting package.",
                        self.node_id, curr_feat, new_feat, sender, package.get("epoch", "?")
                    )
                    return False, None
                
        except Exception as exc:
            logger.error("[%s] Model reconstruction failed: %s", self.node_id, exc)
            return False, None

        n_trees = package.get("n_trees", getattr(updated_model, "n_estimators_", 0))
        logger.info("[%s] Model applied from %s (epoch=%s, trees=%d)", 
                    self.node_id, sender, package.get("epoch"), n_trees)
        return True, updated_model
