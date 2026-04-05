"""Generate deployment-safe secrets for Render/Vercel setup."""

from __future__ import annotations

import secrets

from cryptography.fernet import Fernet


def main() -> None:
    print(f"JWT_SECRET_KEY={secrets.token_urlsafe(48)}")
    print(f"DATA_ENCRYPTION_KEY={Fernet.generate_key().decode('utf-8')}")


if __name__ == "__main__":
    main()
