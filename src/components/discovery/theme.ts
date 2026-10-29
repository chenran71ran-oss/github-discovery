import type { CSSProperties } from "react"

/**
 * 配色方案。液态玻璃需要有颜色可折射，所以每套由「底色 + 三团光晕 + 文字 + 强调色」组成。
 * 新增主题只需在 themes 里加一项，选择器和样式会自动跟上；
 * 深色主题的光晕在 style.css 里被压暗，保证正文与辅助文字对比度不低于 4.5:1。
 */
export interface RadarTheme {
  id: string
  name: string
  mode: "dark" | "light"
  bg: string
  orbs: [string, string, string]
  ink: string
  accent: string
}

export const themes: RadarTheme[] = [
  { id: "aurora", name: "极光", mode: "dark", bg: "#060a18", orbs: ["#4f6bff", "#19c8a0", "#9b5cf6"], ink: "#eef2ff", accent: "#6ee7c8" },
  { id: "dusk", name: "暮色", mode: "dark", bg: "#12081c", orbs: ["#ff5c8a", "#ff9d4d", "#7c5cff"], ink: "#fff1f5", accent: "#ff93b4" },
  { id: "ocean", name: "深海", mode: "dark", bg: "#041420", orbs: ["#0ea5e9", "#14b8a6", "#2563eb"], ink: "#e8f6ff", accent: "#5cd0ff" },
  { id: "forest", name: "森林", mode: "dark", bg: "#06130e", orbs: ["#22c55e", "#a3e635", "#06b6d4"], ink: "#ecfdf3", accent: "#86efac" },
  { id: "coral", name: "珊瑚", mode: "dark", bg: "#140b0b", orbs: ["#ff4d4d", "#ff9f1c", "#c026d3"], ink: "#fff3ee", accent: "#ff9a7a" },
  { id: "graphite", name: "石墨", mode: "dark", bg: "#0b0c10", orbs: ["#3a4156", "#5b5fc7", "#2c6e8a"], ink: "#eceef4", accent: "#b8c4ff" },
  { id: "mist", name: "晨雾", mode: "light", bg: "#eef3fb", orbs: ["#8fb4ff", "#ffc2e2", "#b9a7ff"], ink: "#101828", accent: "#2f5fe0" },
  { id: "cream", name: "奶油", mode: "light", bg: "#fbf4ea", orbs: ["#ffc98a", "#ffa89b", "#ffe08a"], ink: "#2a1d14", accent: "#b93c0a" },
  { id: "mint", name: "薄荷", mode: "light", bg: "#eaf8f2", orbs: ["#7fe0bf", "#9ccfff", "#fff1a0"], ink: "#0b2a21", accent: "#0a7554" },
  { id: "lilac", name: "丁香", mode: "light", bg: "#f3eefb", orbs: ["#c4b0ff", "#ffbfe0", "#a7d0ff"], ink: "#1d1330", accent: "#6a3bd0" },
]

export const defaultThemeId = { dark: "aurora", light: "mist" } as const
const storageKeys = { dark: "radar-theme-dark", light: "radar-theme-light" } as const

export function findTheme(id: string | null | undefined, mode: "dark" | "light"): RadarTheme {
  return themes.find(t => t.id === id && t.mode === mode) || themes.find(t => t.id === defaultThemeId[mode])!
}
export function readThemeId(mode: "dark" | "light") {
  try {
    return findTheme(localStorage.getItem(storageKeys[mode]), mode).id
  } catch {
    return defaultThemeId[mode]
  }
}
export function saveThemeId(theme: RadarTheme) {
  try {
    localStorage.setItem(storageKeys[theme.mode], theme.id)
  } catch {
    // 浏览器禁用存储时，本次选择仍然生效，只是不会被记住
  }
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** 实心强调色按钮上的文字色：亮色强调用深字，深色强调用白字。 */
export function accentInk(accent: string) {
  return luminance(accent) > 0.35 ? "#0b1020" : "#ffffff"
}
export function themeVars(theme: RadarTheme): CSSProperties {
  return {
    "--bg": theme.bg,
    "--o1": theme.orbs[0],
    "--o2": theme.orbs[1],
    "--o3": theme.orbs[2],
    "--ink": theme.ink,
    "--accent": theme.accent,
    "--accent-ink": accentInk(theme.accent),
  } as CSSProperties
}
/** 选择器里的缩略预览：和页面背景使用同一组颜色。 */
export function previewBackground(theme: RadarTheme) {
  const [a, b, c] = theme.orbs
  return `radial-gradient(circle at 18% 22%, ${a}, transparent 56%), radial-gradient(circle at 88% 30%, ${b}, transparent 52%), radial-gradient(circle at 52% 108%, ${c}, transparent 58%), ${theme.bg}`
}
