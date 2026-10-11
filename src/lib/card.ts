import { classify, type Repo } from "../../shared/contracts";
export const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const number = (n: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
export function renderCard(r: Repo, period: string) {
  const cats = r.summary?.categories ?? classify(r.description, r.topics);
  const growth = r.delta24h ?? r.periodStars;
  const title =
    period === "rising"
      ? `观测 ${r.intervalHours?.toFixed(1)} 小时`
      : period === "weekly"
        ? "本周新增"
        : period === "monthly"
          ? "本月新增"
          : "今日新增";
  return `<article class="repo-card" data-repo="${esc(r.fullName)}"><div class="card-heading"><span class="rank">${String(r.rank).padStart(2, "0")}</span><div class="repo-title"><span class="repo-owner">${esc(r.owner)}</span><h2><a class="detail-link" href="/repo/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.name)}">${esc(r.name)}</a></h2></div><button class="save-button icon-button" data-save="${esc(r.fullName)}" aria-label="收藏 ${esc(r.fullName)}" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z"/></svg></button></div><p class="repo-description">${esc(r.summary?.summary ?? r.description ?? "")}</p><div class="tags">${cats.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}${r.summaryStatus !== "ready" ? '<span class="tag pending">中文摘要待更新</span>' : ""}</div>${r.summary?.useCase ? `<p class="use-case"><span>适合</span> ${esc(r.summary.useCase)}</p>` : ""}<div class="card-footer"><div class="metrics"><span class="language"><i></i>${esc(r.language || "未标注")}</span><span title="总 Star 数">☆ ${number(r.stars)}</span><span class="growth" title="${esc(title)}">↗ +${number(growth)}</span>${period === "rising" ? `<span title="60% 增量、30% 增长率、10% Fork 增量，归一化评分">指数 ${r.risingScore?.toFixed(1)}</span>` : ""}</div><div class="card-actions"><a class="github-link" href="https://github.com/${esc(r.fullName)}" target="_blank" rel="noopener noreferrer">GitHub ↗</a><button class="more-link" data-detail="${esc(r.fullName)}">解读 <span>→</span></button></div></div></article>`;
}
