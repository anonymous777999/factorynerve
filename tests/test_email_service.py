import smtplib

from backend import email_service


def test_send_email_uses_resend_api_when_key_is_available(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.resend.com")
    monkeypatch.setenv("SMTP_PORT", "465")
    monkeypatch.setenv("SMTP_USER", "resend")
    monkeypatch.setenv("SMTP_PASSWORD", "re_test_key")
    monkeypatch.setenv("SMTP_FROM", "no-reply@send.factorynerve.online")
    monkeypatch.setenv("SMTP_USE_TLS", "false")
    monkeypatch.setenv("SMTP_USE_SSL", "true")
    monkeypatch.setenv("SMTP_DRY_RUN", "false")

    calls: list[tuple] = []

    class FakeResponse:
        def raise_for_status(self):
            return None

    def fake_post(url, headers=None, json=None, timeout=None):
        calls.append((url, headers, json, timeout))
        return FakeResponse()

    def fail_smtp(*args, **kwargs):
        raise AssertionError("SMTP transport should not be used when Resend API is available.")

    monkeypatch.setattr(email_service.requests, "post", fake_post)
    monkeypatch.setattr(email_service.smtplib, "SMTP", fail_smtp)
    monkeypatch.setattr(email_service.smtplib, "SMTP_SSL", fail_smtp)

    result = email_service.send_email(
        to_emails=["anonymous152023@gmail.com"],
        subject="hello",
        body="world",
    )

    assert result == {"sent": True, "dry_run": False}
    assert calls
    url, headers, payload, timeout = calls[0]
    assert url == "https://api.resend.com/emails"
    assert headers["Authorization"] == "Bearer re_test_key"
    assert payload["from"] == "no-reply@send.factorynerve.online"
    assert payload["to"] == ["anonymous152023@gmail.com"]
    assert payload["subject"] == "hello"
    assert payload["text"] == "world"
    assert timeout == email_service.RESEND_API_TIMEOUT_SECONDS


def test_send_email_uses_primary_starttls_path(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.resend.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "resend")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    monkeypatch.setenv("SMTP_FROM", "onboarding@resend.dev")
    monkeypatch.setenv("SMTP_USE_TLS", "true")
    monkeypatch.setenv("SMTP_USE_SSL", "false")
    monkeypatch.setenv("SMTP_DRY_RUN", "false")

    calls: list[tuple] = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            calls.append(("connect", host, port, timeout))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def ehlo(self):
            calls.append(("ehlo",))

        def starttls(self, context=None):
            calls.append(("starttls", context is not None))

        def login(self, user, password):
            calls.append(("login", user, password))

        def send_message(self, message):
            calls.append(("send", message["To"], message["From"], message["Subject"]))

    monkeypatch.setattr(email_service.smtplib, "SMTP", FakeSMTP)

    result = email_service.send_email(
        to_emails=["delivered@resend.dev"],
        subject="hello",
        body="world",
    )

    assert result == {"sent": True, "dry_run": False}
    assert ("connect", "smtp.resend.com", 587, email_service.SMTP_TIMEOUT_SECONDS) in calls
    assert ("starttls", True) in calls
    assert ("login", "resend", "secret") in calls
    assert ("send", "delivered@resend.dev", "onboarding@resend.dev", "hello") in calls


def test_send_email_retries_resend_with_alternate_transport(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.resend.com")
    monkeypatch.setenv("SMTP_PORT", "465")
    monkeypatch.setenv("SMTP_USER", "resend")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    monkeypatch.setenv("SMTP_FROM", "onboarding@resend.dev")
    monkeypatch.setenv("SMTP_USE_TLS", "false")
    monkeypatch.setenv("SMTP_USE_SSL", "true")
    monkeypatch.setenv("SMTP_DRY_RUN", "false")

    calls: list[tuple] = []

    class BrokenSMTPSSL:
        def __init__(self, host, port, timeout, context):
            calls.append(("ssl_connect", host, port, timeout, context is not None))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def ehlo(self):
            calls.append(("ssl_ehlo",))

        def login(self, user, password):
            calls.append(("ssl_login", user, password))
            raise smtplib.SMTPServerDisconnected("Connection unexpectedly closed")

        def send_message(self, message):
            calls.append(("ssl_send", message["To"]))

    class WorkingSMTP:
        def __init__(self, host, port, timeout):
            calls.append(("smtp_connect", host, port, timeout))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def ehlo(self):
            calls.append(("smtp_ehlo",))

        def starttls(self, context=None):
            calls.append(("smtp_starttls", context is not None))

        def login(self, user, password):
            calls.append(("smtp_login", user, password))

        def send_message(self, message):
            calls.append(("smtp_send", message["To"], message["Subject"]))

    monkeypatch.setattr(email_service.smtplib, "SMTP_SSL", BrokenSMTPSSL)
    monkeypatch.setattr(email_service.smtplib, "SMTP", WorkingSMTP)

    result = email_service.send_email(
        to_emails=["delivered@resend.dev"],
        subject="retry",
        body="body",
    )

    assert result == {"sent": True, "dry_run": False}
    assert ("ssl_connect", "smtp.resend.com", 465, email_service.SMTP_TIMEOUT_SECONDS, True) in calls
    assert ("smtp_connect", "smtp.resend.com", 587, email_service.SMTP_TIMEOUT_SECONDS) in calls
    assert ("smtp_starttls", True) in calls
    assert ("smtp_send", "delivered@resend.dev", "retry") in calls


def test_send_email_falls_back_to_smtp_when_resend_api_fails(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.resend.com")
    monkeypatch.setenv("SMTP_PORT", "465")
    monkeypatch.setenv("SMTP_USER", "resend")
    monkeypatch.setenv("SMTP_PASSWORD", "re_test_key")
    monkeypatch.setenv("SMTP_FROM", "no-reply@send.factorynerve.online")
    monkeypatch.setenv("SMTP_USE_TLS", "false")
    monkeypatch.setenv("SMTP_USE_SSL", "true")
    monkeypatch.setenv("SMTP_DRY_RUN", "false")

    calls: list[tuple] = []

    def broken_post(*args, **kwargs):
        raise email_service.requests.Timeout("timed out")

    class WorkingSMTPSSL:
        def __init__(self, host, port, timeout, context):
            calls.append(("ssl_connect", host, port, timeout, context is not None))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def ehlo(self):
            calls.append(("ssl_ehlo",))

        def login(self, user, password):
            calls.append(("ssl_login", user, password))

        def send_message(self, message):
            calls.append(("ssl_send", message["To"], message["Subject"]))

    monkeypatch.setattr(email_service.requests, "post", broken_post)
    monkeypatch.setattr(email_service.smtplib, "SMTP_SSL", WorkingSMTPSSL)

    result = email_service.send_email(
        to_emails=["anonymous152023@gmail.com"],
        subject="fallback",
        body="body",
    )

    assert result == {"sent": True, "dry_run": False}
    assert ("ssl_connect", "smtp.resend.com", 465, email_service.SMTP_TIMEOUT_SECONDS, True) in calls
    assert ("ssl_send", "anonymous152023@gmail.com", "fallback") in calls
