import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const { owner, name } = params;
  if (!owner || !name) return new Response('Not found', { status: 404 });

  const db = (locals as any).runtime.env.DB as D1Database;

  // Query repo from DB
  const repo = await db
    .prepare('SELECT * FROM trending_repos WHERE owner = ? AND name = ? ORDER BY created_at DESC LIMIT 1')
    .bind(owner, name)
    .first<Record<string, any>>();

  if (!repo) return new Response('Not found', { status: 404 });

  let summary = '';
  try {
    const parsed = JSON.parse(repo.ai_summary || '{}');
    summary = (parsed.summary || '').substring(0, 120);
  } catch { /* */ }

  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#0d1117"/>
    <rect x="0" y="0" width="1200" height="4" fill="#58a6ff"/>

    <!-- Brand -->
    <text x="60" y="70" font-family="system-ui, sans-serif" font-size="24" fill="#7d8590">🔥 GitHub Trends TR</text>

    <!-- Repo name -->
    <text x="60" y="180" font-family="system-ui, sans-serif" font-size="52" font-weight="bold" fill="#e6edf3">${escapeXml(owner)}/</text>
    <text x="60" y="240" font-family="system-ui, sans-serif" font-size="52" font-weight="bold" fill="#58a6ff">${escapeXml(name)}</text>

    <!-- Stats -->
    <text x="60" y="320" font-family="system-ui, sans-serif" font-size="28" fill="#7d8590">
      ${repo.language ? `${escapeXml(repo.language)}  ·  ` : ''}⭐ ${formatK(repo.stars)}  ·  🍴 ${formatK(repo.forks)}${repo.period_stars > 0 ? `  ·  🔥 +${formatK(repo.period_stars)}` : ''}
    </text>

    <!-- Summary -->
    <text x="60" y="400" font-family="system-ui, sans-serif" font-size="24" fill="#c9d1d9">${escapeXml(summary)}${summary.length >= 120 ? '...' : ''}</text>

    <!-- Footer -->
    <rect x="0" y="560" width="1200" height="70" fill="#161b22"/>
    <text x="60" y="605" font-family="system-ui, sans-serif" font-size="22" fill="#484f58">trends.softween.com · Türkçe GitHub Trending Analizi</text>
  </svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}
