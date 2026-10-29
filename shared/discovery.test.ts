import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { type DiscoverySnapshot, breakoutRules, filterRepositories, isBreakout, isSnapshot, periods } from "./discovery"

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
