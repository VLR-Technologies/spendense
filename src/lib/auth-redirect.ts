/** Both public production aliases use the requested canonical OAuth destination. */
export const canonicalAppOrigin = "https://spendense.com";
function productionHost(hostname: string) {
  return hostname === "spendense.com" || hostname === "www.spendense.com";
}
export function googleCallbackUrl(origin: string) {
  const url = new URL(origin);
  return `${productionHost(url.hostname) ? canonicalAppOrigin : url.origin}/auth/callback`;
}
export function callbackOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (
    productionHost(url.hostname) ||
    host === "spendense.com" ||
    host === "www.spendense.com"
  )
    return canonicalAppOrigin;
  // Local Next dev may normalize request.url to localhost. Preserve the actual cookie host.
  if (
    process.env.NODE_ENV !== "production" &&
    host &&
    /^(127\.0\.0\.1|localhost):\d+$/.test(host)
  )
    return `http://${host}`;
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      const app = new URL(configured);
      if (app.origin === url.origin && !app.username && !app.password)
        return app.origin;
    } catch {
      /* A malformed setting must not turn callbacks into open redirects. */
    }
  }
  return url.origin;
}
