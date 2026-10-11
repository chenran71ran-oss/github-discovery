import {
  classify,
  summarySchema,
  querySchema,
  type Listing,
  type Repo,
  type DiscoveryQuery,
} from "../../shared/contracts";
import { esc, number, renderCard } from "./card";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const initial = JSON.parse($("initial-data").textContent!) as {
  listing: Listing;
  query: DiscoveryQuery;
  dbError: boolean;
};
let listing = initial.listing,
  query = initial.query,
  scope = "all",
  controller: AbortController | null = null,
  requestId = 0;
let saved: Record<string, Repo> = {},
  read: string[] = [];
const detailCache = new Map<string, Repo>();
function validRepo(value: unknown): value is Repo {
  if (!value || typeof value !== "object") return false;
  const r = value as Repo;
  return (
    /^[\w.-]+\/[\w.-]+$/.test(r.fullName) &&
    r.fullName === r.owner + "/" + r.name &&
    [r.owner, r.name, r.description, r.language].every(
      (x) => typeof x === "string",
    ) &&
    [r.stars, r.forks, r.periodStars, r.rank].every(
      (x) => Number.isFinite(x) && x >= 0,
    ) &&
    Array.isArray(r.topics) &&
    r.topics.every((x) => typeof x === "string") &&
    (r.summary === null || summarySchema.safeParse(r.summary).success)
  );
}
try {
  const raw = JSON.parse(localStorage.getItem("discovery-saved") ?? "{}");
  for (const [k, v] of Object.entries(raw))
    if (validRepo(v) && k === v.fullName) saved[k] = v;
  read = JSON.parse(localStorage.getItem("discovery-read") ?? "[]").filter(
    (v: unknown) => typeof v === "string",
  );
} catch {}
function toast(text: string) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  setTimeout(() => ($("toast").hidden = true), 2500);
}
function persist() {
  try {
    localStorage.setItem("discovery-saved", JSON.stringify(saved));
    localStorage.setItem("discovery-read", JSON.stringify(read.slice(-2000)));
  } catch {
    toast("当前浏览器无法保存偏好");
  }
}
let hideRead = false;
try {
  hideRead = localStorage.getItem("discovery-hide-read") === "true";
} catch {}
$<HTMLInputElement>("hide-read").checked = hideRead;
let view = "grid";
try {
  view = localStorage.getItem("discovery-view") ?? "grid";
} catch {}
function applyView(value: string) {
  view = value === "list" ? "list" : "grid";
  $("repo-grid").dataset.view = view;
  document
    .querySelectorAll<HTMLElement>("[data-view]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.view === view)),
    );
  try {
    localStorage.setItem("discovery-view", view);
  } catch {}
}
function visible() {
  let repos = scope === "saved" ? Object.values(saved) : listing.repos;
  if (scope === "saved") {
    const q = query.q.toLowerCase();
    repos = repos.filter(
      (r) =>
        (!query.language || r.language === query.language) &&
        (!query.category ||
          (r.summary?.categories ?? classify(r.description, r.topics)).includes(
            query.category,
          )) &&
        (!q ||
          (
            r.fullName +
            " " +
            r.description +
            " " +
            (r.summary?.summary ?? "") +
            " " +
            (r.summary?.useCase ?? "") +
            " " +
            (r.summary?.techStack.join(" ") ?? "")
          )
            .toLowerCase()
            .includes(q)),
    );
    if (query.sort === "stars") repos.sort((a, b) => b.stars - a.stars);
    if (query.sort === "growth")
      repos.sort(
        (a, b) => (b.delta24h ?? b.periodStars) - (a.delta24h ?? a.periodStars),
      );
  }
  return hideRead ? repos.filter((r) => !read.includes(r.fullName)) : repos;
}
function render() {
  const repos = visible();
  $("repo-grid").innerHTML = repos
    .map((r) =>
      renderCard(
        r,
        scope === "saved" ? (r.savedPeriod ?? "daily") : query.period,
      ),
    )
    .join("");
  $("result-count").textContent = String(repos.length);
  $("saved-count").textContent = String(Object.keys(saved).length);
  $("empty-state").hidden = repos.length > 0;
  $("empty-state").querySelector("h2")!.textContent =
    scope === "saved"
      ? "还没有符合条件的收藏"
      : query.period === "rising" && !listing.ready
        ? "正在积累增长数据"
        : listing.capturedAt
          ? "没有匹配的项目"
          : "等待首次采集";
  $("empty-state").querySelector("p")!.textContent =
    scope === "saved"
      ? "点击项目右上角的书签即可收藏。已有收藏时，可清除筛选或取消隐藏已读。"
      : query.period === "rising" && !listing.ready
        ? "至少需要两次相隔约 24 小时的有效采样，期间可以浏览其他榜单。"
        : listing.capturedAt
          ? "换一个关键词或清除筛选条件，再看看。"
          : "完成数据库初始化并运行采集后，这里会自动显示真实榜单。";
  $("source-note").textContent =
    scope === "saved"
      ? "收藏保存在当前浏览器；卡片数据为收藏时的记录。"
      : listing.source === "demo"
        ? "演示数据 · 仅用于本地界面验证，不代表实时榜单。"
        : listing.source?.startsWith("isboyjc")
          ? "备用数据源：" +
            listing.source +
            (listing.stale ? " · 当前展示上次成功的数据。" : "")
          : query.period === "rising"
            ? `独立采样约 24 小时的增长，目前 ${listing.sampled} 个项目具备对比数据。指数由 Star 增量、增长率和 Fork 增量计算。`
            : "榜单来自 GitHub Trending，中文解读根据项目 README 生成。" +
              (listing.stale ? " 当前展示上次成功的数据。" : "");
  $("updated-at").textContent = listing.capturedAt
    ? new Date(listing.capturedAt).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }) + " 更新"
    : "等待首次采集";
  document.querySelectorAll<HTMLElement>("[data-period]").forEach((b) => {
    const on = b.dataset.period === query.period;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
  document.querySelectorAll<HTMLElement>("[data-category]").forEach((b) => {
    const on = b.dataset.category === query.category;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
  document.querySelectorAll<HTMLElement>("[data-scope]").forEach((b) => {
    const on = b.dataset.scope === scope;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
  document.querySelectorAll<HTMLElement>("[data-save]").forEach((b) => {
    const on = !!saved[b.dataset.save!];
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", (on ? "取消收藏 " : "收藏 ") + b.dataset.save);
  });
  applyView(view);
}
function syncUrl(push = true) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query))
    if (
      v &&
      !(k === "period" && v === "daily") &&
      !(k === "sort" && v === "rank")
    )
      params.set(k, v);
  const url = "/" + (params.size ? "?" + params : "");
  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}
function updateSelects() {
  const lang = $<HTMLSelectElement>("language");
  lang.innerHTML =
    '<option value="">全部语言</option>' +
    listing.languages
      .map((x) => `<option value="${esc(x)}">${esc(x)}</option>`)
      .join("");
  if (query.language && !listing.languages.includes(query.language))
    lang.add(new Option(query.language, query.language));
  lang.value = query.language;
  const date = $<HTMLSelectElement>("date");
  date.innerHTML =
    '<option value="">最新榜单</option>' +
    listing.dates.map((x) => `<option value="${x}">${x}</option>`).join("");
  if (query.date && !listing.dates.includes(query.date))
    date.add(new Option(query.date, query.date));
  date.value = query.date ?? "";
  $<HTMLSelectElement>("sort").value = query.sort;
  $<HTMLInputElement>("search").value = query.q;
}
async function load(push = true) {
  const id = ++requestId;
  controller?.abort();
  controller = new AbortController();
  if (push) syncUrl();
  $("repo-grid").setAttribute("aria-busy", "true");
  $("feedback").hidden = true;
  try {
    const params = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined) as [
        string,
        string,
      ][],
    );
    const response = await fetch("/api/trending?" + params, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error();
    const next = (await response.json()) as Listing;
    if (id !== requestId) return;
    listing = next;
    updateSelects();
    render();
  } catch (e) {
    if (
      id !== requestId ||
      (e instanceof DOMException && e.name === "AbortError")
    )
      return;
    $("feedback").textContent = "更新失败，暂时保留此前结果。点击重试。";
    $("feedback").hidden = false;
  } finally {
    if (id === requestId) $("repo-grid").setAttribute("aria-busy", "false");
  }
}
let searchTimer: ReturnType<typeof setTimeout>;
$("search").addEventListener("input", () => {
  clearTimeout(searchTimer);
  query.q = $<HTMLInputElement>("search").value;
  searchTimer = setTimeout(() => void load(), 250);
});
for (const key of ["language", "date", "sort"] as const)
  $(key).addEventListener("change", () => {
    query = {
      ...query,
      [key]:
        $<HTMLSelectElement>(key).value || (key === "date" ? undefined : ""),
    };
    void load();
  });
$("hide-read").addEventListener("change", () => {
  hideRead = $<HTMLInputElement>("hide-read").checked;
  try {
    localStorage.setItem("discovery-hide-read", String(hideRead));
  } catch {}
  render();
});
$("reset-filters").addEventListener("click", () => {
  query = {
    ...query,
    language: "",
    category: "",
    q: "",
    date: undefined,
    sort: "rank",
  };
  hideRead = false;
  try {
    localStorage.setItem("discovery-hide-read", "false");
  } catch {}
  $<HTMLInputElement>("hide-read").checked = false;
  void load();
});
$("feedback").addEventListener("click", () => void load(false));
function markRead(name: string) {
  if (!read.includes(name)) {
    read.push(name);
    persist();
  }
}
let detailController: AbortController | null = null;
function historyChart(
  values: { capturedAt: string; stars: number; period: string; rank: number }[],
) {
  const unique = [...new Map(values.map((x) => [x.capturedAt, x])).values()]
    .reverse()
    .slice(-20);
  if (unique.length < 2)
    return '<p class="detail-muted">增长曲线积累中，至少需要两次采样。</p>';
  const min = Math.min(...unique.map((x) => x.stars)),
    max = Math.max(...unique.map((x) => x.stars));
  const points = unique
    .map(
      (v, i) =>
        `${10 + (i * 580) / (unique.length - 1)},${100 - ((v.stars - min) * 80) / Math.max(1, max - min)}`,
    )
    .join(" ");
  return `<svg class="history-chart" viewBox="0 0 600 120" role="img" aria-label="最近 ${unique.length} 次榜单记录，Star 从 ${unique[0].stars} 到 ${unique.at(-1)!.stars}"><path d="M10 100H590" class="chart-axis"/><polyline points="${points}" class="chart-line"/></svg><div class="chart-labels"><span>${esc(unique[0].capturedAt.slice(0, 10))} · ${number(unique[0].stars)}</span><span>${esc(unique.at(-1)!.capturedAt.slice(0, 10))} · ${number(unique.at(-1)!.stars)}</span></div>`;
}
async function openDetail(name: string) {
  detailController?.abort();
  detailController = new AbortController();
  const signal = detailController.signal;
  const dialog = $<HTMLDialogElement>("detail-dialog");
  $("detail-content").innerHTML =
    '<h2 id="detail-title">正在读取项目解读…</h2>';
  if (!dialog.open) dialog.showModal();
  try {
    const response = await fetch("/api/repo?name=" + encodeURIComponent(name), {
      signal,
    });
    if (!response.ok) throw new Error();
    const { repo: r, history: rows } = (await response.json()) as {
      repo: Repo;
      history: {
        capturedAt: string;
        stars: number;
        period: string;
        rank: number;
      }[];
    };
    if (signal.aborted) return;
    detailCache.set(name, r);
    markRead(name);
    $("detail-content").innerHTML =
      `<p class="detail-owner">${esc(r.owner)}</p><h2 id="detail-title">${esc(r.name)}</h2><p class="detail-summary">${esc(r.summary?.summary ?? r.description)}</p><div class="detail-stats"><span>☆ ${number(r.stars)} Stars</span><span>⑂ ${number(r.forks)} Forks</span><span>${esc(r.language)}</span><span>${esc(r.license || "许可待确认")}</span></div>${r.summary ? `<h3>适用场景</h3><p>${esc(r.summary.useCase)}</p><h3>技术栈</h3><div class="tags">${r.summary.techStack.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div><h3>值得关注</h3><ul>${r.summary.highlights.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : '<p class="detail-muted">中文解读尚未生成，目前展示仓库原始描述。</p>'}<h3>Star 记录</h3>${historyChart(rows)}<details class="readme-panel"><summary>查看 README 原文</summary><pre>${esc(r.readme ?? "原文尚未缓存，可前往 GitHub 阅读。")}</pre></details><div class="detail-bottom"><a class="button primary" href="https://github.com/${esc(r.fullName)}" target="_blank" rel="noopener noreferrer">在 GitHub 打开 ↗</a><button class="button secondary" data-save="${esc(r.fullName)}" aria-pressed="${!!saved[r.fullName]}">${saved[r.fullName] ? "已收藏" : "收藏项目"}</button></div>`;
  } catch (e) {
    if (signal.aborted) return;
    $("detail-content").innerHTML =
      '<h2 id="detail-title">暂时无法读取项目</h2><p>请关闭后重试，或从卡片直接前往 GitHub。</p>';
  }
}
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLElement>(
    "[data-period],[data-category],[data-view],[data-scope],[data-save],[data-detail],[data-close]",
  );
  if (button) {
    if (button.dataset.period) {
      query.period = button.dataset.period as DiscoveryQuery["period"];
      scope = "all";
      void load();
    }
    if (button.dataset.category !== undefined) {
      query.category = button.dataset.category as DiscoveryQuery["category"];
      void load();
    }
    if (button.dataset.view) applyView(button.dataset.view);
    if (button.dataset.scope) {
      scope = button.dataset.scope;
      render();
    }
    if (button.dataset.save) {
      const name = button.dataset.save;
      if (saved[name]) delete saved[name];
      else {
        const repo =
          listing.repos.find((x) => x.fullName === name) ??
          detailCache.get(name);
        if (repo)
          saved[name] = { ...repo, readme: null, savedPeriod: query.period };
        else {
          toast("请回到榜单收藏这个项目");
          return;
        }
      }
      persist();
      render();
      if (button.closest("dialog")) {
        button.setAttribute("aria-pressed", String(!!saved[name]));
        button.textContent = saved[name] ? "已收藏" : "收藏项目";
      }
      toast(saved[name] ? "已加入收藏" : "已取消收藏");
    }
    if (button.dataset.detail) void openDetail(button.dataset.detail);
    if (button.dataset.close) {
      $<HTMLDialogElement>(button.dataset.close).close();
      if (button.dataset.close === "detail-dialog") {
        detailController?.abort();
        render();
      }
    }
  }
  const link = target.closest<HTMLAnchorElement>(".github-link,.detail-link");
  if (link) {
    const name = link.closest<HTMLElement>("[data-repo]")?.dataset.repo;
    if (name) markRead(name);
    try {
      sessionStorage.setItem("discovery-scroll", String(window.scrollY));
      sessionStorage.setItem("discovery-scroll-url", location.href);
    } catch {}
  }
});
document.querySelectorAll("dialog").forEach((d) => {
  d.addEventListener("click", (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      const m = e as MouseEvent;
      if (
        m.clientX < r.left ||
        m.clientX > r.right ||
        m.clientY < r.top ||
        m.clientY > r.bottom
      )
        d.close();
    }
  });
  d.addEventListener("close", () => {
    if (d.id === "detail-dialog") {
      detailController?.abort();
      render();
    }
  });
});
window.addEventListener("popstate", () => {
  const result = querySchema.safeParse(
    Object.fromEntries(new URLSearchParams(location.search)),
  );
  query = result.success ? result.data : querySchema.parse({});
  void load(false);
});
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !(e.target instanceof HTMLInputElement) &&
    !(e.target instanceof HTMLTextAreaElement) &&
    !document.querySelector("dialog[open]")
  ) {
    e.preventDefault();
    $("search").focus();
  }
});
function theme(value: string) {
  const mode = ["light", "dark", "system"].includes(value) ? value : "system";
  try {
    localStorage.setItem("discovery-theme", mode);
  } catch {}
  document.documentElement.dataset.theme =
    mode === "system"
      ? matchMedia("(prefers-color-scheme:dark)").matches
        ? "dark"
        : "light"
      : mode;
  document
    .querySelectorAll<HTMLElement>("[data-theme-choice]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.themeChoice === mode)),
    );
}
$("theme-toggle").addEventListener("click", () =>
  theme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"),
);
$("open-settings").addEventListener("click", () => {
  let t = "system";
  try {
    t = localStorage.getItem("discovery-theme") ?? "system";
  } catch {}
  theme(t);
  $<HTMLDialogElement>("settings-dialog").showModal();
});
document
  .querySelectorAll<HTMLElement>("[data-theme-choice]")
  .forEach((b) =>
    b.addEventListener("click", () => theme(b.dataset.themeChoice!)),
  );
matchMedia("(prefers-color-scheme:dark)").addEventListener("change", () => {
  try {
    if ((localStorage.getItem("discovery-theme") ?? "system") === "system")
      theme("system");
  } catch {}
});
$("export-data").addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ version: 1, saved, read }, null, 2)], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "github-discovery-backup.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("import-data").addEventListener("change", async () => {
  const file = $<HTMLInputElement>("import-data").files?.[0];
  if (!file) return;
  try {
    if (file.size > 2e6) throw new Error();
    const data = JSON.parse(await file.text());
    if (
      data.version !== 1 ||
      !data.saved ||
      typeof data.saved !== "object" ||
      !Array.isArray(data.read) ||
      Object.keys(data.saved).length > 1000 ||
      !data.read.every(
        (x: unknown) => typeof x === "string" && /^[\w.-]+\/[\w.-]+$/.test(x),
      )
    )
      throw new Error();
    for (const [k, v] of Object.entries(data.saved)) {
      if (!validRepo(v) || v.fullName !== k) throw new Error();
    }
    saved = { ...saved, ...data.saved };
    read = [...new Set([...read, ...data.read])] as string[];
    persist();
    render();
    $("settings-message").textContent = "已导入，现有收藏也已保留。";
  } catch {
    $("settings-message").textContent =
      "无法导入，请选择本站导出的 JSON 备份。";
  }
});
render();
applyView(view);
try {
  if (sessionStorage.getItem("discovery-scroll-url") === location.href) {
    const scroll = Number(sessionStorage.getItem("discovery-scroll"));
    requestAnimationFrame(() => window.scrollTo(0, scroll));
    sessionStorage.removeItem("discovery-scroll-url");
  }
} catch {}
