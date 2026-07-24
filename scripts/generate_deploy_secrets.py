"""Generate deployment-safe secrets for Render/Vercel setup."""

from __future__ import annotations

import secrets

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


def main() -> None:
    print(f"JWT_SECRET_KEY={secrets.token_urlsafe(48)}")
    print(f"DATA_ENCRYPTION_KEY={Fernet.generate_key().decode('utf-8')}")

    # Generate RSA 2048-bit key pair for JWT RS256 signing
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
    print()
    print("# RSA key pair for JWT RS256 signing (copy both to env)")
    print("# JWT_RSA_PRIVATE_KEY — keep secret, used for signing")
    print("JWT_RSA_PRIVATE_KEY<<EOF")
    print(private_pem, end="")
    print("EOF")
    print()
    print("# JWT_RSA_PUBLIC_KEY — safe to share, used for verification")
    print("JWT_RSA_PUBLIC_KEY<<EOF")
    print(public_pem, end="")
    print("EOF")


if __name__ == "__main__":
    main()
