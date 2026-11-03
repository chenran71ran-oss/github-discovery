/**
 * 第 2 层：GitHub 登录。用 GitHub App 的用户授权流程，只用来确认「你是谁」。
 * 第一步不保存 GitHub 令牌：拿到用户信息后令牌就丢弃。
 */
import { GITHUB_API, GITHUB_AUTHORIZE, GITHUB_TOKEN } from "./config"
import type { GitHubUser } from "./types"

type Fetch = typeof fetch

export function authorizeUrl(clientId: string, redirectUri: string, state: string) {
  const url = new URL(GITHUB_AUTHORIZE)
  // 控制台粘贴的值常带首尾空格（会被编码成 "+"，GitHub 就认不出这个 App）
  url.searchParams.set("client_id", clientId.trim())
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("state", state)
  url.searchParams.set("allow_signup", "false")
  return url.toString()
}

export async function exchangeCode(code: string, redirectUri: string, clientId: string, clientSecret: string, fetcher: Fetch = fetch) {
  const response = await fetcher(GITHUB_TOKEN, {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json", "User-Agent": "git-bot-radar" },
    body: JSON.stringify({ client_id: clientId.trim(), client_secret: clientSecret.trim(), code, redirect_uri: redirectUri }),
  })
  const data = await response.json().catch(() => ({})) as { access_token?: string, error?: string }
  if (!response.ok || !data.access_token) throw new Error(`token exchange failed: ${data.error || response.status}`)
  return data.access_token
}

export async function fetchUser(token: string, fetcher: Fetch = fetch): Promise<GitHubUser> {
  const response = await fetcher(`${GITHUB_API}/user`, {
    headers: { "Authorization": `Bearer ${token}`, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "git-bot-radar" },
  })
  if (!response.ok) throw new Error(`user lookup failed: ${response.status}`)
  const user = await response.json() as Partial<GitHubUser>
  if (typeof user.id !== "number" || typeof user.login !== "string") throw new Error("user lookup returned no id")
  return { id: user.id, login: user.login, name: user.name ?? null, avatar_url: user.avatar_url ?? "" }
}
