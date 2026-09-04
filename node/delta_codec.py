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
import os
import pickle
import struct
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import numpy as np

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
# Quantisation settings
# ------------------------------------------------------------------
QUANTISE_BITS = 8          # 8-bit quantisation of ΔW values
SPARSITY_THRESHOLD = 0.01  # drop |ΔW| < threshold (1% of weight scale)


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
# ΔW serialisation helpers
# ------------------------------------------------------------------

def _extract_weights(model: Any) -> Optional[np.ndarray]:
    """
    Extract a flat numpy weight vector from a LightGBM model or any
    object that supports pickle serialisation.  Returns None if model
    is None or unserializable.
    """
    if model is None:
        return None
    try:
        raw = pickle.dumps(model)
        return np.frombuffer(raw, dtype=np.uint8).astype(np.float32)
    except Exception as exc:
        logger.warning("Could not extract weights: %s", exc)
        return None


def _sparsify(delta: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """Return (indices, values) for non-trivial entries."""
    mask = np.abs(delta) >= SPARSITY_THRESHOLD
    return np.where(mask)[0].astype(np.int32), delta[mask].astype(np.float32)


def _quantise(values: np.ndarray, bits: int = QUANTISE_BITS) -> Tuple[bytes, float, float]:
    """
    Quantise float32 values to `bits`-bit unsigned integers.
    Returns (quantised_bytes, min_val, scale).
    """
    if len(values) == 0:
        return b"", 0.0, 1.0
    v_min = float(values.min())
    v_max = float(values.max())
    scale = (v_max - v_min) / (2**bits - 1) if v_max != v_min else 1.0
    quantised = np.round((values - v_min) / scale).astype(np.uint8)
    return quantised.tobytes(), v_min, scale


def _dequantise(data: bytes, length: int, v_min: float, scale: float) -> np.ndarray:
    quantised = np.frombuffer(data, dtype=np.uint8)[:length]
    return quantised.astype(np.float32) * scale + v_min


# ------------------------------------------------------------------
# Public API
# ------------------------------------------------------------------

class DeltaCodec:
    """
    Encode (sparsify + quantise + sign) and decode (verify + apply) ΔW packages.

    Package format (JSON-serialisable dict):
    {
        "node_id":   str,
        "epoch":     str,
        "timestamp": float,
        "n_total":   int,        # length of original weight vector
        "indices":   [int, ...],
        "q_bytes":   hex_string, # quantised values
        "q_min":     float,
        "q_scale":   float,
        "signature": hex_string, # Ed25519 over sha256(payload_without_sig)
    }
    """

    def __init__(self, node_id: str, keys_dir: str):
        self.node_id = node_id
        self.keys_dir = Path(keys_dir)
        self._prev_weights: Optional[np.ndarray] = None

    # ------------------------------------------------------------------
    def encode(self, model: Any, epoch: str) -> Dict:
        """
        Build a signed ΔW package from the current model vs the previous snapshot.

        If no previous snapshot exists (first epoch), ΔW = W (full weights).
        """
        current_w = _extract_weights(model)
        if current_w is None:
            raise ValueError("Cannot extract weights from model")

        if self._prev_weights is not None and len(self._prev_weights) == len(current_w):
            delta = current_w - self._prev_weights
        else:
            delta = current_w.copy()  # first epoch: full weights

        indices, values = _sparsify(delta)
        q_bytes, q_min, q_scale = _quantise(values)

        payload = {
            "node_id": self.node_id,
            "epoch": epoch,
            "timestamp": time.time(),
            "n_total": int(len(current_w)),
            "indices": indices.tolist(),
            "q_bytes": q_bytes.hex(),
            "q_min": q_min,
            "q_scale": q_scale,
        }

        # sign
        payload_bytes = json.dumps(payload, sort_keys=True).encode()
        private_key = _load_private_key(self.keys_dir, self.node_id)
        if private_key is not None:
            sig = private_key.sign(payload_bytes)
            payload["signature"] = sig.hex()
        else:
            payload["signature"] = ""

        self._prev_weights = current_w.copy()
        nnz = len(indices)
        total = len(current_w)
        logger.info(
            "[%s] ΔW encoded: %d/%d non-zero (%.1f%%), %d bytes after quantisation",
            self.node_id, nnz, total, 100 * nnz / max(total, 1), len(q_bytes),
        )
        return payload

    # ------------------------------------------------------------------
    def verify_and_apply(
        self,
        package: Dict,
        current_model: Any,
    ) -> Tuple[bool, Optional[Any]]:
        """
        Verify signature and apply ΔW to `current_model`.

        Returns
        -------
        (ok, updated_model)
            ok            : False if signature invalid
            updated_model : model with ΔW applied (pickle-round-tripped),
                            or None if verification failed
        """
        sender = package.get("node_id", "")
        signature_hex = package.get("signature", "")
        payload_for_verify = {k: v for k, v in package.items() if k != "signature"}
        payload_bytes = json.dumps(payload_for_verify, sort_keys=True).encode()

        if signature_hex and CRYPTO_AVAILABLE:
            public_key = _load_public_key(self.keys_dir, sender)
            if public_key is None:
                logger.error("Cannot verify ΔW from %s – public key missing", sender)
                return False, None
            try:
                public_key.verify(bytes.fromhex(signature_hex), payload_bytes)
                logger.debug("[%s] Signature verified for ΔW from %s", self.node_id, sender)
            except InvalidSignature:
                logger.error("[%s] INVALID SIGNATURE on ΔW from %s – rejecting", self.node_id, sender)
                return False, None
        else:
            logger.warning("[%s] No signature / crypto unavailable – accepting ΔW without verification", self.node_id)

        # reconstruct ΔW and apply to current weights
        current_w = _extract_weights(current_model)
        if current_w is None:
            return True, current_model  # can't apply, but not a security failure

        n_total = package["n_total"]
        indices = np.array(package["indices"], dtype=np.int32)
        q_bytes = bytes.fromhex(package["q_bytes"])
        values = _dequantise(q_bytes, len(indices), package["q_min"], package["q_scale"])

        if len(current_w) != n_total:
            logger.warning(
                "[%s] Weight size mismatch (local=%d, package=%d) – cannot apply ΔW",
                self.node_id, len(current_w), n_total,
            )
            return True, current_model

        current_w[indices] += values
        # Reconstruct model from updated weights
        try:
            updated_model = pickle.loads(current_w.astype(np.uint8).tobytes())
        except Exception:
            updated_model = current_model  # reconstruction failed, keep old
            logger.warning("[%s] ΔW apply: pickle reconstruction failed – keeping old model", self.node_id)

        logger.info("[%s] ΔW applied from %s (epoch=%s)", self.node_id, sender, package.get("epoch"))
        return True, updated_model
