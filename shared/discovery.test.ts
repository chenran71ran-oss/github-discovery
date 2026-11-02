import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { type DiscoverySnapshot, breakoutRules, categoryNames, filterRepositories, isBreakout, isSnapshot, periods } from "./discovery"
import { categories, categoryOf, domains, fallback } from "./taxonomy"

const data = JSON.parse(readFileSync("public/data/latest.json", "utf8")) as DiscoverySnapshot

describe("discovery data contract", () => {
  it("validates real collected data and rejects malformed data", () => {
    expect(isSnapshot(data)).toBe(true)
    expect(isSnapshot({ ...data, periods: { daily: [] } })).toBe(false)
    expect(isSnapshot({ ...data, generatedAt: "invalid" })).toBe(false)
  })
  it("preserves distinct membership and original rank for each period", () => {
    for (const rows of Object.values(data.periods)) {
      expect(rows.length).toBeGreaterThanOrEqual(5)
      expect(new Set(rows.map(r => r.fullName)).size).toBe(rows.length)
      expect(rows.map(r => r.rank)).toEqual(rows.map((_, i) => i + 1))
    }
  })
  it("combines Chinese search, language, category and saved membership", () => {
    const repo = data.periods.daily.find(r => r.summary)!
    const result = filterRepositories(data.periods.daily, repo.summary!.slice(0, 4), repo.language, repo.category, [repo.fullName])
    expect(result.map(r => r.fullName)).toEqual([repo.fullName])
    expect(filterRepositories(data.periods.daily, "", "", "", [])).toEqual([])
  })
})

describe("search", () => {
  const base = { ...data.periods.daily[0], tags: [] as string[], purposes: [] as string[], topics: [] as string[] }
  const book = { ...base, fullName: "acme/ledger", description: "Self-hosted budgeting app", summary: "自托管的记账应用", language: "Go", techStack: ["Vue"], category: "理财与金融" }
  const chat = { ...base, fullName: "acme/chat", description: "An AI chat client", summary: "AI 聊天客户端", language: "Rust", techStack: [], category: "社交与通讯" }
  it("requires every space-separated word, in any order", () => {
    expect(filterRepositories([book, chat], "记账 vue", "", "").map(r => r.fullName)).toEqual(["acme/ledger"])
    expect(filterRepositories([book, chat], "vue 记账", "", "").map(r => r.fullName)).toEqual(["acme/ledger"])
    expect(filterRepositories([book, chat], "记账 rust", "", "")).toEqual([])
  })
  it("ignores case and full-width input", () => {
    expect(filterRepositories([book, chat], "ＡＩ", "", "").map(r => r.fullName)).toEqual(["acme/chat"])
    expect(filterRepositories([book, chat], "LEDGER", "", "").map(r => r.fullName)).toEqual(["acme/ledger"])
  })
  it("matches language, category labels and the owner/name", () => {
    expect(filterRepositories([book, chat], "go", "", "").map(r => r.fullName)).toEqual(["acme/ledger"])
    expect(filterRepositories([book, chat], "社交", "", "").map(r => r.fullName)).toEqual(["acme/chat"])
    expect(filterRepositories([book, chat], "acme/", "", "")).toHaveLength(2)
    expect(filterRepositories([book, chat], "   ", "", "")).toHaveLength(2)
  })
})

describe("categories", () => {
  it("offers a filter for every category the collector can assign", () => {
    const doc = JSON.parse(readFileSync("shared/taxonomy.json", "utf8"))
    expect(categoryNames.slice(1)).toEqual([...doc.categories.map((c: { label: string }) => c.label), doc.fallback.label])
    expect(categoryNames.length).toBeGreaterThan(20)
  })
  it("maps renamed labels from older snapshots", () => {
    expect(categoryOf("学习与研究").label).toBe("教程与资源")
    expect(categoryOf("not a label")).toBe(fallback)
  })
  it("filters by domain and matches secondary tags", () => {
    const base = { ...data.periods.daily[0], tags: [] as string[] }
    const fit = { ...base, fullName: "a/fit", category: "健康与运动", tags: ["移动与桌面"] }
    const vpn = { ...base, fullName: "a/vpn", category: "安全与隐私", tags: [] }
    expect(filterRepositories([fit, vpn], "", "", "移动与桌面").map(r => r.fullName)).toEqual(["a/fit"])
    expect(filterRepositories([fit, vpn], "", "", "", undefined, "life").map(r => r.fullName)).toEqual(["a/fit"])
    expect(filterRepositories([fit, vpn], "健康", "", "").map(r => r.fullName)).toEqual(["a/fit"])
  })
  it("every category belongs to a known domain", () => {
    const ids = new Set(domains.map(d => d.id))
    expect(categories.every(c => ids.has(c.domain))).toBe(true)
  })
})

describe("breakout flag", () => {
  it("needs both a large share of total stars and a large absolute gain", () => {
    expect(isBreakout({ stars: 3200, periodStars: 1200 }, "daily")).toBe(true)
    expect(isBreakout({ stars: 116400, periodStars: 1400 }, "daily")).toBe(false)
    expect(isBreakout({ stars: 400, periodStars: 150 }, "daily")).toBe(false)
  })
  it("ignores rows without a period gain or without total stars", () => {
    expect(isBreakout({ stars: 900, periodStars: null }, "weekly")).toBe(false)
    expect(isBreakout({ stars: 0, periodStars: 5000 }, "monthly")).toBe(false)
  })
  it("uses a stricter bar for longer periods", () => {
    const row = { stars: 6000, periodStars: 1500 }
    expect(isBreakout(row, "daily")).toBe(true)
    expect(isBreakout(row, "weekly")).toBe(true)
    expect(isBreakout(row, "monthly")).toBe(false)
  })
  it("only flags real rows that satisfy the published rules", () => {
    for (const period of periods) {
      for (const row of data.periods[period]) {
        if (!isBreakout(row, period)) continue
        expect(row.periodStars).toBeGreaterThanOrEqual(breakoutRules[period].min)
        expect(row.periodStars! / row.stars).toBeGreaterThanOrEqual(breakoutRules[period].share)
      }
    }
  })
})
