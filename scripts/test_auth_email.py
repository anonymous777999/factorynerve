"""SMTP + auth email smoke test for DPR.ai."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.email_service import send_email  # noqa: E402
from backend.services.email_verification_service import build_verification_link  # noqa: E402
from backend.services.password_reset_service import build_reset_link  # noqa: E402


def _mask(value: str | None) -> str:
    if not value:
        return "missing"
    if len(value) <= 4:
        return "present"
    return f"present ({value[:2]}***{value[-2:]})"


def _required_env() -> dict[str, str | None]:
    return {
        "APP_ENV": os.getenv("APP_ENV"),
        "SMTP_HOST": os.getenv("SMTP_HOST"),
        "SMTP_PORT": os.getenv("SMTP_PORT"),
        "SMTP_USER": os.getenv("SMTP_USER"),
        "SMTP_PASSWORD": os.getenv("SMTP_PASSWORD"),
        "SMTP_FROM": os.getenv("SMTP_FROM"),
        "SMTP_USE_TLS": os.getenv("SMTP_USE_TLS"),
        "SMTP_USE_SSL": os.getenv("SMTP_USE_SSL"),
        "SMTP_DRY_RUN": os.getenv("SMTP_DRY_RUN"),
        "EMAIL_VERIFICATION_BASE_URL": os.getenv("EMAIL_VERIFICATION_BASE_URL"),
        "EMAIL_VERIFICATION_EXPOSE_LINK": os.getenv("EMAIL_VERIFICATION_EXPOSE_LINK"),
        "PASSWORD_RESET_BASE_URL": os.getenv("PASSWORD_RESET_BASE_URL"),
        "PASSWORD_RESET_EXPOSE_LINK": os.getenv("PASSWORD_RESET_EXPOSE_LINK"),
    }


def _print_config_summary() -> None:
    env = _required_env()
    print("Auth email config summary:")
    for key, value in env.items():
        if key == "SMTP_PASSWORD":
            print(f"  - {key}: {_mask(value)}")
        else:
            print(f"  - {key}: {value or 'missing'}")


def _missing_required() -> list[str]:
    required = ["SMTP_HOST", "SMTP_PORT", "SMTP_FROM"]
    missing = [key for key in required if not (os.getenv(key) or "").strip()]
    user = (os.getenv("SMTP_USER") or "").strip()
    password = (os.getenv("SMTP_PASSWORD") or "").strip()
    if bool(user) != bool(password):
        missing.append("SMTP_USER + SMTP_PASSWORD must both be set for authenticated SMTP")
    return missing


def _provider_hint(host: str | None) -> str | None:
    normalized = (host or "").strip().lower()
    if "gmail" in normalized:
        return "Gmail usually needs SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USE_TLS=true, and an app password."
    if "zoho" in normalized:
        return "Zoho usually needs SMTP_HOST=smtp.zoho.in or smtp.zoho.com, SMTP_PORT=587, SMTP_USE_TLS=true."
    if "resend" in normalized:
        return "Resend SMTP usually uses SMTP_HOST=smtp.resend.com, SMTP_PORT=465, SMTP_USE_SSL=true."
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Send a DPR.ai auth email smoke test.")
    parser.add_argument("--to", required=True, help="Inbox to receive the test email")
    parser.add_argument(
        "--kind",
        choices=("verification", "reset"),
        default="verification",
        help="Which auth email template to send",
    )
    parser.add_argument(
        "--token",
        default="smoke-test-token",
        help="Token text to embed in the generated link",
    )
    args = parser.parse_args()

    load_dotenv(PROJECT_ROOT / ".env")
    _print_config_summary()

    missing = _missing_required()
    if missing:
        print("\nMissing SMTP configuration:")
        for item in missing:
            print(f"  - {item}")
        hint = _provider_hint(os.getenv("SMTP_HOST"))
        if hint:
            print(f"\nHint: {hint}")
        return 1

    if args.kind == "verification":
        link = build_verification_link(args.token)
        subject = os.getenv("EMAIL_VERIFICATION_EMAIL_SUBJECT") or "Verify your DPR.ai email"
        body = (
            "This is a DPR.ai verification email smoke test.\n\n"
            f"Verification link:\n{link}\n\n"
            "If you received this, SMTP is working for verification emails."
        )
    else:
        link = build_reset_link(args.token)
        subject = os.getenv("PASSWORD_RESET_EMAIL_SUBJECT") or "Reset your DPR.ai password"
        body = (
            "This is a DPR.ai password reset email smoke test.\n\n"
            f"Reset link:\n{link}\n\n"
            "If you received this, SMTP is working for password reset emails."
        )

    result = send_email(
        to_emails=[args.to],
        subject=subject,
        body=body,
    )
    print("\nSMTP smoke test completed.")
    print(f"  - kind: {args.kind}")
    print(f"  - to: {args.to}")
    print(f"  - sent: {result.get('sent')}")
    print(f"  - dry_run: {result.get('dry_run')}")
    print(f"  - link: {link}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
