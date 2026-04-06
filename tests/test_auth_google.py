from backend.routers.auth_google import _build_frontend_redirect, _sanitize_next_path


def test_sanitize_next_path_rejects_external_or_auth_routes():
    assert _sanitize_next_path(None) == "/"
    assert _sanitize_next_path("https://example.com") == "/"
    assert _sanitize_next_path("//evil.test") == "/"
    assert _sanitize_next_path("/login") == "/"
    assert _sanitize_next_path("/register") == "/"


def test_sanitize_next_path_keeps_safe_internal_routes():
    assert _sanitize_next_path("/dashboard") == "/dashboard"
    assert _sanitize_next_path("/approvals?tab=pending") == "/approvals?tab=pending"


def test_build_frontend_redirect_uses_base_origin_and_query(monkeypatch):
    monkeypatch.setenv("FRONTEND_OAUTH_REDIRECT", "https://www.factorynerve.online")

    redirect = _build_frontend_redirect("/approvals", {"oauth_error": "Google sign-in failed"})

    assert redirect == "https://www.factorynerve.online/approvals?oauth_error=Google+sign-in+failed"


def test_build_frontend_redirect_supports_base_path(monkeypatch):
    monkeypatch.setenv("FRONTEND_OAUTH_REDIRECT", "https://factorynerve.online/app")

    redirect = _build_frontend_redirect("/dashboard")

    assert redirect == "https://factorynerve.online/app/dashboard"
