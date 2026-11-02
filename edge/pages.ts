/**
 * 第 4 层：登录页。由服务端直接返回的独立 HTML，不加载站点的脚本和数据。
 * 颜色与站点一致（深色 / 浅色跟随系统），强调色是 Windows 系统蓝。
 */
const messages: Record<string, { tone: "info" | "warn" | "error", text: string }> = {
  pending: { tone: "info", text: "已收到你的申请。站长通过之后，再次登录即可进入。" },
  blocked: { tone: "error", text: "这个账号已被停用，如有疑问请联系站长。" },
  denied: { tone: "warn", text: "你取消了 GitHub 授权，需要授权后才能登录。" },
  expired: { tone: "warn", text: "登录已过期或链接失效，请重新登录。" },
  error: { tone: "error", text: "登录时出了点问题，请稍后重试。" },
  signedout: { tone: "info", text: "已退出登录。" },
}

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!))

export function loginPage(next: string, status: string | null) {
  const message = status ? messages[status] : undefined
  const href = `/api/auth/login?next=${encodeURIComponent(next)}`
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0b0d12" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#f5f6f8" media="(prefers-color-scheme: light)">
<link rel="icon" href="/icon.svg">
<title>登录 · GIT Bot</title>
<style>
:root { --bg: #f5f6f8; --ink: #141821; --muted: #4a5160; --card: #ffffff; --line: rgba(20, 24, 33, 0.1); --accent: #0067c0; --accent-ink: #fff; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg: #0b0d12; --ink: #e9ecf2; --muted: #a9b0bd; --card: #151922; --line: rgba(233, 236, 242, 0.1); --accent: #4cc2ff; --accent-ink: #001a2c; color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px; background: var(--bg); color: var(--ink); font: 15px/1.6 -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; }
main { width: 100%; max-width: 380px; padding: 32px 28px; border-radius: 20px; background: var(--card); box-shadow: inset 0 0 0 1px var(--line), 0 24px 60px -30px rgba(0, 0, 0, 0.45); text-align: center; }
.mark { width: 56px; height: 56px; margin: 0 auto 14px; display: grid; place-items: center; border-radius: 50%; background: var(--accent); color: var(--accent-ink); }
.mark svg { width: 30px; height: 30px; }
h1 { margin: 0; font-size: 22px; }
h1 b { color: var(--accent); }
.lead { margin: 6px 0 24px; color: var(--muted); font-size: 14px; }
.btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; height: 46px; border-radius: 12px; background: var(--ink); color: var(--bg); font-weight: 650; text-decoration: none; transition: transform 0.15s, opacity 0.15s; }
.btn:hover { opacity: 0.92; }
.btn:active { transform: scale(0.98); }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.btn svg { width: 20px; height: 20px; }
.msg { margin: 0 0 18px; padding: 10px 12px; border-radius: 10px; font-size: 13.5px; text-align: left; }
.msg.info { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.msg.warn { background: color-mix(in srgb, #f59e0b 16%, transparent); }
.msg.error { background: color-mix(in srgb, #ef4444 15%, transparent); }
.note { margin: 18px 0 0; color: var(--muted); font-size: 12.5px; }
</style>
</head>
<body>
<main>
  <div class="mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><path d="M4 10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></div>
  <h1>GIT <b>Bot</b></h1>
  <p class="lead">用中文发现 GitHub 上正在升温的开源项目</p>
  ${message ? `<p class="msg ${message.tone}" role="status">${escape(message.text)}</p>` : ""}
  <a class="btn" href="${escape(href)}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/></svg>使用 GitHub 登录</a>
  <p class="note">仅限受邀成员。第一次登录会提交访问申请，由站长审批。</p>
</main>
</body>
</html>`
}
