"""
generate_keys.py
Bootstrap Ed25519 keypairs for all 6 nodes into the ./keys/ directory.
Run once before `docker compose up`.

Usage:
    python scripts/generate_keys.py
"""

import json
import sys
from pathlib import Path

NODES = ["CA", "TX", "OH", "WY", "NY", "NJ"]
KEYS_DIR = Path(__file__).parent.parent / "keys"

try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives.serialization import (
        Encoding, NoEncryption, PrivateFormat, PublicFormat
    )
    CRYPTO_OK = True
except ImportError:
    CRYPTO_OK = False
    print("ERROR: 'cryptography' package not installed.")
    print("  Run: pip install cryptography")
    sys.exit(1)


def main():
    KEYS_DIR.mkdir(parents=True, exist_ok=True)
    public_registry = {}

    for node_id in NODES:
        priv_path = KEYS_DIR / f"{node_id}_private.pem"
        if priv_path.exists():
            print(f"[{node_id}] Key already exists, skipping.")
            # Still load public key into registry
            from cryptography.hazmat.primitives.serialization import load_pem_private_key
            pk = load_pem_private_key(priv_path.read_bytes(), password=None)
            pub_bytes = pk.public_key().public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo)
            public_registry[node_id] = pub_bytes.decode()
            continue

        private_key = Ed25519PrivateKey.generate()
        public_key = private_key.public_key()

        priv_bytes = private_key.private_bytes(
            encoding=Encoding.PEM,
            format=PrivateFormat.PKCS8,
            encryption_algorithm=NoEncryption(),
        )
        pub_bytes = public_key.public_bytes(
            encoding=Encoding.PEM,
            format=PublicFormat.SubjectPublicKeyInfo,
        )

        priv_path.write_bytes(priv_bytes)
        print(f"[{node_id}] Private key -> {priv_path}")
        public_registry[node_id] = pub_bytes.decode()

    reg_path = KEYS_DIR / "public_registry.json"
    reg_path.write_text(json.dumps(public_registry, indent=2))
    print(f"\nPublic key registry -> {reg_path}")
    print("\nDone. All keypairs generated.")


if __name__ == "__main__":
    main()
