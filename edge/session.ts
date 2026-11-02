/**
 * 第 2 层：签名 Cookie。内容是 base64url(JSON) + "." + base64url(HMAC-SHA256)。
 * 只签名、不加密：Cookie 里只有 GitHub id、用户名、角色和时间，不放令牌。
 */
const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(text: string) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4))
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
}

export async function sign(payload: object, secret: string) {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body)))
  return `${body}.${toBase64Url(signature)}`
}

/** 签名不对、格式不对或已过期都返回 null。比较签名用 subtle.verify，是常量时间的。 */
export async function verify<T extends { exp: number }>(token: string | undefined, secret: string, now = Math.floor(Date.now() / 1000)): Promise<T | null> {
  if (!token) return null
  const [body, signature, extra] = token.split(".")
  if (!body || !signature || extra !== undefined) return null
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromBase64Url(signature), encoder.encode(body))
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as T
    return typeof payload?.exp === "number" && payload.exp > now ? payload : null
  } catch {
    return null
  }
}

export function randomToken(bytes = 18) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}
