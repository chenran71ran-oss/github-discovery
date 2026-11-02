/**
 * 外交层：页面与外部的全部交互——读取同源 JSON 快照、浏览器存储里的收藏。
 * 组件不直接 fetch 或读写 localStorage，换数据源时只改这里。
 */
import { type DiscoverySnapshot, type Repository, isSnapshot } from "@shared/discovery"

export const savedKey = "discovery-next-favorites-v1"
const fullName = /^[\w.-]+\/[\w.-]+$/

export async function loadSnapshot(date = "", signal?: AbortSignal): Promise<DiscoverySnapshot> {
  const response = await fetch(date ? `/data/history/${date}.json` : "/data/latest.json", { signal, cache: "no-cache" })
  if (!response.ok) throw new Error("榜单暂时没有加载成功，请稍后重试。")
  const value: unknown = await response.json()
  if (!isSnapshot(value)) throw new Error("榜单数据格式异常，暂时无法展示。")
  return value
}

export async function loadDates(): Promise<string[]> {
  const response = await fetch("/data/dates.json")
  return response.ok ? response.json() : []
}

export function readSaved(): Record<string, Repository> {
  try {
    const value = JSON.parse(localStorage.getItem(savedKey) || "{}")
    return value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([key, r]) => fullName.test(key) && r && typeof r === "object" && (r as Repository).fullName === key)) as Record<string, Repository> : {}
  } catch {
    return {}
  }
}

/** 返回是否写入成功；浏览器禁用存储时调用方提示用户。 */
export function writeSaved(next: Record<string, Repository>) {
  try {
    localStorage.setItem(savedKey, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

export function isRepoName(value: string | null): value is string {
  return !!value && fullName.test(value)
}
