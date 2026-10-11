// Explicit LOCAL demo fixtures. Never run against a remote database.
import { writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
if (!process.argv.includes("--demo"))
  throw new Error("Run npm run seed -- --demo for LOCAL demo data only");
const q = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const projects = [
  [
    "cloudflare",
    "workers-sdk",
    "TypeScript",
    24000,
    180,
    "Cloudflare Workers 的开发与部署工具集合，包含 Wrangler CLI 和本地运行环境。",
    "在 Cloudflare 上开发站点、API 与定时任务。",
    ["Cloudflare", "Developer Tools"],
  ],
  [
    "immich-app",
    "immich",
    "TypeScript",
    72000,
    960,
    "自托管照片与视频管理平台，提供自动备份、相册浏览与搜索。",
    "给家人搭建自己的照片备份与浏览服务。",
    ["Self-hosted", "Media", "Docker"],
  ],
  [
    "Stirling-Tools",
    "Stirling-PDF",
    "Java",
    58000,
    310,
    "在浏览器中处理 PDF 的工具集合，支持拆分、合并、转换等常用操作。",
    "部署自己的 PDF 工具站，集中处理文档。",
    ["Self-hosted", "Developer Tools"],
  ],
  [
    "microsoft",
    "markitdown",
    "Python",
    62000,
    740,
    "把多种文档转为 Markdown，便于后续文本分析与处理。",
    "将文档资料整理为可检索的文本，供知识库使用。",
    ["AI / Agent", "Developer Tools"],
  ],
  [
    "anthropics",
    "claude-code",
    "TypeScript",
    51000,
    620,
    "面向终端的 AI 编程工具，围绕代码库执行开发任务。",
    "在项目中分析代码、完成修改并运行检查。",
    ["AI / Agent", "Developer Tools"],
  ],
  [
    "ourongxing",
    "newsnow",
    "TypeScript",
    9000,
    230,
    "聚合多种来源的热点信息，用统一界面浏览不同榜单。",
    "部署一个集中查看资讯和热点的网站。",
    ["Dashboard", "Self-hosted"],
  ],
  [
    "home-assistant",
    "core",
    "Python",
    81000,
    430,
    "开源家庭自动化平台，连接设备并组织自动化流程。",
    "集中管理家里的智能设备与日常自动化。",
    ["Self-hosted", "Dashboard"],
  ],
  [
    "actualbudget",
    "actual",
    "TypeScript",
    19000,
    150,
    "开源个人财务管理工具，以账户、预算与交易记录组织收支。",
    "维护自己的收支记录与预算。",
    ["Self-hosted", "Interesting"],
  ],
];
const now = new Date(),
  prior = new Date(now.getTime() - 86400000);
let sql = "";
for (const [
  owner,
  name,
  language,
  stars,
  growth,
  summary,
  useCase,
  categories,
] of projects) {
  const full = owner + "/" + name;
  const summaryJSON = JSON.stringify({
    summary,
    useCase,
    techStack: [language],
    highlights: ["本地界面验证示例，功能请以项目 README 为准"],
    categories,
  });
  sql += `INSERT OR REPLACE INTO discovery_repos(full_name,owner,name,description,language,topics,license,summary,summary_status,summary_version,summary_at,readme,updated_at) VALUES(${q(full)},${q(owner)},${q(name)},${q(summary)},${q(language)},'[]','MIT',${q(summaryJSON)},'ready','demo',${q(now.toISOString())},${q("# " + name + "\n\n演示用 README 占位。请前往项目仓库阅读原文。")},${q(now.toISOString())});\n`;
  for (const [date, value] of [
    [prior, stars - growth],
    [now, stars],
  ])
    sql += `INSERT OR REPLACE INTO discovery_metrics(full_name,captured_at,stars,forks) VALUES(${q(full)},${q(date.toISOString())},${value},${Math.floor(value / 20)});\n`;
}
for (const period of ["daily", "weekly", "monthly"])
  for (const date of [prior, now]) {
    const id = "demo-" + period + "-" + date.toISOString();
    sql += `INSERT OR REPLACE INTO discovery_snapshots(id,period,captured_at,source,status,repo_count) VALUES(${q(id)},${q(period)},${q(date.toISOString())},'demo','ready',${projects.length});\n`;
    projects.forEach(([owner, name, language, stars, growth], i) => {
      sql += `INSERT OR REPLACE INTO discovery_entries(snapshot_id,full_name,rank,stars,forks,period_stars) VALUES(${q(id)},${q(owner + "/" + name)},${i + 1},${stars},${Math.floor(stars / 20)},${growth * (period === "daily" ? 1 : period === "weekly" ? 5 : 12)});\n`;
    });
  }
mkdirSync(".wrangler", { recursive: true });
writeFileSync(".wrangler/demo.sql", sql);
const result = spawnSync(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "d1",
    "execute",
    "github-discovery-db",
    "--local",
    "--config",
    "worker/wrangler.jsonc",
    "--persist-to",
    ".wrangler/state",
    "--file",
    ".wrangler/demo.sql",
  ],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
