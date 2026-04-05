export function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const pattern = new RegExp(`(?:^|; )${name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}=([^;]*)`);
  const match = document.cookie.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

