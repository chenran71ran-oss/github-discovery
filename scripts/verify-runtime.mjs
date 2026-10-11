import { Miniflare } from "miniflare";
import { writeFileSync, readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import os from "node:os";
const original = os.networkInterfaces;
os.networkInterfaces = () => {
  try {
    return original();
  } catch {
    return {};
  }
};
const mf = new Miniflare({
  modules: [
    { type: "ESModule", path: "dist/_worker.js/index.js" },
    ...readdirSync("dist/_worker.js", { recursive: true })
      .filter((n) => /\.(mjs|js)$/.test(n) && n !== "index.js")
      .map((n) => ({ type: "ESModule", path: "dist/_worker.js/" + n })),
  ],
  modulesRoot: "dist/_worker.js",
  compatibilityDate: "2026-10-01",
  compatibilityFlags: ["nodejs_compat", "disable_nodejs_process_v2"],
  d1Databases: { DB: "00000000-0000-0000-0000-000000000000" },
  d1Persist: false,
});
try {
  const db = await mf.getD1Database("DB");
  const sql = readFileSync(".wrangler/demo.sql", "utf8");
  for (const stmt of readFileSync("migrations/0001_discovery.sql", "utf8")
    .split(";")
    .filter((s) => s.trim()))
    await db.prepare(stmt).run();
  for (const stmt of sql.split(";").filter((s) => s.trim()))
    await db.prepare(stmt).run();
  const response = await mf.dispatchFetch("http://localhost/");
  assert.equal(response.status, 200);
  let html = await response.text();
  assert.ok(html.includes("workers-sdk"));
  const cases = [
    [
      "/api/trending?period=weekly&language=Python&category=Dashboard&q=core",
      200,
      1,
    ],
    ["/api/trending?period=rising", 200, 8],
    ["/api/trending?date=2026-02-31", 400, null],
    ["/api/repo?name=cloudflare/workers-sdk", 200, null],
    ["/repo/cloudflare/workers-sdk", 200, null],
    ["/api/repo?name=invalid", 400, null],
  ];
  for (const [url, status, count] of cases) {
    const r = await mf.dispatchFetch("http://localhost" + url);
    assert.equal(r.status, status, url);
    if (count !== null) assert.equal((await r.json()).repos.length, count, url);
  }
  const listing = await (
    await mf.dispatchFetch("http://localhost/api/trending")
  ).json();
  const details = {};
  const catalog = {};
  for (const period of ["daily", "weekly", "monthly", "rising"])
    for (const date of ["", ...listing.dates])
      catalog[period + ":" + date] = await (
        await mf.dispatchFetch(
          "http://localhost/api/trending?period=" +
            period +
            (date ? "&date=" + date : ""),
        )
      ).json();
  for (const repo of listing.repos)
    details[repo.fullName] = await (
      await mf.dispatchFetch("http://localhost/api/repo?name=" + repo.fullName)
    ).json();
  const cssFile = readdirSync("dist/_astro").find((n) => n.endsWith(".css"));
  const css = readFileSync("dist/_astro/" + cssFile, "utf8");
  const jsFile = readdirSync("dist/_astro").find(
    (n) => n.startsWith("index.astro") && n.endsWith(".js"),
  );
  const js = readFileSync("dist/_astro/" + jsFile, "utf8");
  const data = JSON.stringify({ listing, details, catalog }).replaceAll(
    "<",
    "\\u003c",
  );
  const prelude = `history.pushState=()=>{};history.replaceState=()=>{};const demo=${data};window.fetch=async(url)=>{const u=new URL(url,location.href);if(u.pathname==='/api/repo')return new Response(JSON.stringify(demo.details[u.searchParams.get('name')]),{status:200,headers:{'Content-Type':'application/json'}});let p=u.searchParams,l=structuredClone(demo.catalog[(p.get('period')||'daily')+':'+(p.get('date')||'')]||demo.listing);l.repos=l.repos.filter(r=>(!p.get('language')||r.language===p.get('language'))&&(!p.get('category')||r.summary.categories.includes(p.get('category')))&&(!p.get('q')||(r.fullName+' '+r.summary.summary+' '+r.summary.useCase).toLowerCase().includes(p.get('q').toLowerCase())));if(p.get('sort')==='stars')l.repos.sort((a,b)=>b.stars-a.stars);if(p.get('sort')==='growth')l.repos.sort((a,b)=>(b.delta24h??b.periodStars)-(a.delta24h??a.periodStars));return new Response(JSON.stringify(l),{status:200,headers:{'Content-Type':'application/json'}})};`;
  html = html
    .replace(/<link rel="stylesheet"[^>]+>/g, "<style>" + css + "</style>")
    .replace(
      /<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/g,
      '<script type="module">' + prelude + js + "</script>",
    )
    .replace(/href="\/favicon.svg"/g, 'href="data:,"')
    .replace(/<link rel="manifest"[^>]+>/g, "");
  // Native preview has no server-side navigation. Keep project details in the real modal.
  html = html.replace(
    "</body>",
    `<script>document.addEventListener('click',e=>{const home=e.target.closest('.brand');if(home){e.preventDefault();document.getElementById('reset-filters').click();window.scrollTo(0,0)}const a=e.target.closest('.detail-link');if(a){e.preventDefault();a.closest('.repo-card').querySelector('[data-detail]').click()}})</script></body>`,
  );
  writeFileSync("GitHub-Discovery-preview.html", html);
  console.log(
    "PASS: production SSR, D1 binding, combined filter API, Rising API, validation, detail API and route. Generated self-contained local demo preview.",
  );
} finally {
  await mf.dispose();
}
