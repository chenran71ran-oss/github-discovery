import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { type DiscoverySnapshot, filterRepositories, isSnapshot } from "./discovery"

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
