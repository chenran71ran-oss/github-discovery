import { type CSSProperties, useState } from "react"

/** 内联 SVG 图标：不依赖图标集的按需生成，iPhone 上首屏也不会出现空白图标。 */
const paths = {
  bot: ["M12 8V4H8", "M4 10a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z", "M2 14h2", "M20 14h2", "M15 13v2", "M9 13v2"],
  radar: ["M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0", "M7.5 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0", "M12 12 19 5"],
  compass: ["M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0", "m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"],
  bookmark: ["m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"],
  refresh: ["M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8", "M21 3v5h-5"],
  sun: ["M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0", "M12 2v2", "M12 20v2", "M4.93 4.93l1.41 1.41", "M17.66 17.66l1.41 1.41", "M2 12h2", "M20 12h2", "M6.34 17.66l-1.41 1.41", "M19.07 4.93l-1.41 1.41"],
  moon: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"],
  palette: ["M13.5 6.5h.01", "M17.5 10.5h.01", "M8.5 7.5h.01", "M6.5 12.5h.01", "M12 22a10 10 0 1 1 10-9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4A1.75 1.75 0 0 1 12 22z"],
  flame: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"],
  trend: ["m22 7-8.5 8.5-5-5L2 17", "M16 7h6v6"],
  calendar: ["M8 2v4", "M16 2v4", "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M3 10h18"],
  star: ["m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"],
  fork: ["M6 3v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V3", "M12 12v9", "M4.5 3a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0", "M16.5 3a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0"],
  search: ["M3 11a8 8 0 1 0 16 0a8 8 0 1 0-16 0", "M21 21l-4.3-4.3"],
  info: ["M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0", "M12 16v-4", "M12 8h.01"],
  clock: ["M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0", "M12 6v6l4 2"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  columns: ["M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 3v18", "M15 3v18"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  check: ["M20 6 9 17l-5-5"],
  arrowUpRight: ["M7 17 17 7", "M7 7h10v10"],
  github: ["M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4", "M9 18c-4.51 2-5-2-7-2"],
  wand: ["m15 4 5 5", "M3 21 14 10", "M17.8 6.2 19 5", "M9 3v2", "M5 7H3", "M21 13h-2", "M15 19v2"],
}
export type IconName = keyof typeof paths

export function Icon({ name, className = "" }: { name: IconName, className?: string }) {
  return (
    <svg className={`i ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name].map(d => <path key={d} d={d} />)}
    </svg>
  )
}

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
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")
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
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
        />
      )}
    </span>
  )
}
