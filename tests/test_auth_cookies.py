from starlette.requests import Request
from starlette.responses import Response

from backend import auth_cookies


def _request_for_host(host: str) -> Request:
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "POST",
        "scheme": "https",
        "path": "/auth/login",
        "raw_path": b"/auth/login",
        "query_string": b"",
        "headers": [(b"host", host.encode("utf-8"))],
        "client": ("127.0.0.1", 12345),
        "server": (host, 443),
    }
    return Request(scope)


def test_www_cookie_domain_is_normalized_to_apex_for_apex_requests(monkeypatch):
    monkeypatch.setattr(auth_cookies, "COOKIE_DOMAIN", "www.factorynerve.online")
    response = Response()

    auth_cookies.set_auth_cookies(
        response=response,
        access_token="access-token",
        refresh_token="refresh-token",
        request=_request_for_host("factorynerve.online"),
    )

    set_cookie_headers = response.headers.getlist("set-cookie")
    assert set_cookie_headers
    assert any("Domain=factorynerve.online" in header for header in set_cookie_headers)
    assert not any("Domain=www.factorynerve.online" in header for header in set_cookie_headers)


def test_unrelated_cookie_domain_is_ignored(monkeypatch):
    monkeypatch.setattr(auth_cookies, "COOKIE_DOMAIN", "app.example.com")
    response = Response()

    auth_cookies.set_auth_cookies(
        response=response,
        access_token="access-token",
        refresh_token="refresh-token",
        request=_request_for_host("factorynerve.online"),
    )

    set_cookie_headers = response.headers.getlist("set-cookie")
    assert set_cookie_headers
    assert not any("Domain=" in header for header in set_cookie_headers)

