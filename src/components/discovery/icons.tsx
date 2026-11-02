import { type CSSProperties, useState } from "react"

/** 内联 SVG 图标：不依赖图标集的按需生成，iPhone 上首屏也不会出现空白图标。 */
const paths = {
  bot: ["M12 8V4H8", "M4 10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z", "M2 14h2", "M20 14h2", "M15 13v2", "M9 13v2"],
  compass: ["M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0", "m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"],
  bookmark: ["m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"],
  flame: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"],
  star: ["m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"],
  fork: ["M6 3v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V3", "M12 12v9", "M4.5 3a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0", "M16.5 3a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0"],
  search: ["M3 11a8 8 0 1 0 16 0a8 8 0 1 0-16 0", "M21 21l-4.3-4.3"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  arrowUpRight: ["M7 17 17 7", "M7 7h10v10"],
  github: ["M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4", "M9 18c-4.51 2-5-2-7-2"],
}
export type IconName = keyof typeof paths

export function Icon({ name, className = "" }: { name: IconName, className?: string }) {
  return (
    <svg className={`i ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name].map(d => <path key={d} d={d} />)}
    </svg>
  )
}

/** 本次访问里已经加载过的头像：列表重新入场时直接显示，不再闪一下字母色块 */
const loaded = new Set<string>()

function hash(text: string) {
  let h = 0
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) >>> 0
  return h
}

/**
 * 项目图标：使用仓库所有者的 GitHub 头像（组织项目即品牌标志）。
 * 加载中和加载失败时显示按所有者着色的首字母方块，列表高度不会因图片加载而跳动。
 */
export function RepoIcon({ fullName }: { fullName: string }) {
  const [owner, name = ""] = fullName.split("/")
  const [state, setState] = useState<"loading" | "ready" | "failed">(() => loaded.has(owner) ? "ready" : "loading")
  return (
    <span className={`repo-icon ${state}`} style={{ "--h": hash(owner) % 360 } as CSSProperties} aria-hidden="true">
      <span className="repo-icon-letter">{name.charAt(0).toUpperCase() || "#"}</span>
      {state !== "failed" && (
        <img
          src={`https://github.com/${owner}.png?size=96`}
          alt=""
          width={44}
          height={44}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => {
            loaded.add(owner)
            setState("ready")
          }}
          onError={() => setState("failed")}
        />
      )}
    </span>
  )
}
