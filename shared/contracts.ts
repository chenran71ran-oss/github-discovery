import { z } from "zod";
export const periods = ["daily", "weekly", "monthly"] as const;
export type Period = (typeof periods)[number];
export const categories = [
  "AI / Agent",
  "Self-hosted",
  "Cloudflare",
  "Dashboard",
  "Developer Tools",
  "Media",
  "Docker",
  "iOS",
  "Interesting",
] as const;
export const summarySchema = z.object({
  summary: z.string().min(4).max(600),
  useCase: z.string().max(400),
  techStack: z.array(z.string().max(50)).max(8),
  highlights: z.array(z.string().max(160)).max(5),
  categories: z.array(z.enum(categories)).min(1).max(3),
});
export type Summary = z.infer<typeof summarySchema>;
export const querySchema = z.object({
  period: z.enum([...periods, "rising"]).default("daily"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        !Number.isNaN(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v,
      "无效日期",
    )
    .optional(),
  language: z.string().max(40).default(""),
  category: z.union([z.literal(""), z.enum(categories)]).default(""),
  q: z.string().trim().max(100).default(""),
  sort: z.enum(["rank", "stars", "growth"]).default("rank"),
});
export type DiscoveryQuery = z.infer<typeof querySchema>;
export interface TrendingRepo {
  fullName: string;
  owner: string;
  name: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  periodStars: number;
  rank: number;
}
export interface Repo extends TrendingRepo {
  savedPeriod?: DiscoveryQuery["period"];
  url: string;
  summary: Summary | null;
  topics: string[];
  homepage: string;
  license: string;
  readme: string | null;
  createdAt: string;
  pushedAt: string;
  summaryStatus: "ready" | "pending" | "failed";
  delta24h: number | null;
  intervalHours: number | null;
  risingScore: number | null;
}
export interface Listing {
  repos: Repo[];
  period: DiscoveryQuery["period"];
  capturedAt: string | null;
  source: string | null;
  stale: boolean;
  total: number;
  languages: string[];
  dates: string[];
  sampled: number;
  ready: boolean;
}
export function classify(description: string, topics: string[] = []): string[] {
  const text = (description + " " + topics.join(" ")).toLowerCase();
  const patterns: [(typeof categories)[number], RegExp][] = [
    ["AI / Agent", /\bagent|\bllm\b|\bai\b|machine.learning|人工智能/],
    ["Self-hosted", /self.host|自托管/],
    ["Cloudflare", /cloudflare|workers|\bd1\b/],
    ["Dashboard", /dashboard|monitor|仪表|监控/],
    ["Media", /media|music|video|emby|音乐|视频/],
    ["Docker", /docker|container|容器/],
    ["iOS", /\bios\b|swift|iphone/],
    ["Developer Tools", /developer|framework|\bcli\b|\bsdk\b|编程|开发/],
  ];
  const result = patterns.filter(([, re]) => re.test(text)).map(([cat]) => cat);
  return result.length ? result.slice(0, 3) : ["Interesting"];
}
export function risingScore(
  delta: number,
  previousStars: number,
  forkDelta: number,
): number {
  if (delta <= 0) return 0;
  return (
    Math.round(
      1000 *
        (0.6 * Math.min(1, Math.log1p(delta) / Math.log1p(5000)) +
          0.3 * Math.min(1, delta / Math.max(100, previousStars)) +
          0.1 *
            Math.min(1, Math.log1p(Math.max(0, forkDelta)) / Math.log1p(500))),
    ) / 10
  );
}
