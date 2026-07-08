import type { APIRoute } from 'astro';
import { getLatestSnapshot, getReposBySnapshot } from '../lib/db';
import type { ParsedRepo } from '../lib/db';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildDescription(repo: ParsedRepo): string {
  const parts: string[] = [];

  if (repo.parsedSummary?.summary) {
    parts.push(repo.parsedSummary.summary);
  } else if (repo.description) {
    parts.push(repo.description);
  }

  if (repo.parsedSummary?.targetAudience) {
    parts.push(`Hedef Kitle: ${repo.parsedSummary.targetAudience}`);
  }

  if (repo.language) {
    parts.push(`Dil: ${repo.language}`);
  }

  parts.push(`Yıldız: ${repo.stars.toLocaleString('tr-TR')}`);

  if (repo.period_stars > 0) {
    const periodLabels: Record<string, string> = {
      daily: 'bugün',
      weekly: 'bu hafta',
      monthly: 'bu ay',
    };
    parts.push(`Bu ${periodLabels[repo.period] ?? 'dönemde'} +${repo.period_stars} yeni yıldız`);
  }

  return escapeXml(parts.join(' | '));
}

export const GET: APIRoute = async ({ locals }) => {
  const db = (locals as Record<string, unknown> & { runtime?: { env?: { DB?: D1Database } } }).runtime?.env?.DB as D1Database;

  const siteUrl = 'https://trends.softween.com';
  const now = new Date().toUTCString();

  let repos: ParsedRepo[] = [];
  let snapshotDate = '';

  if (db) {
    const snapshot = await getLatestSnapshot(db);
    if (snapshot) {
      repos = await getReposBySnapshot(db, snapshot.id, 'daily');
      snapshotDate = snapshot.date;
    }
  }

  const items = repos
    .slice(0, 25)
    .map((repo) => {
      const title = escapeXml(`#${repo.rank} ${repo.full_name}${repo.language ? ` (${repo.language})` : ''}`);
      const link = `${siteUrl}/repo/${repo.owner}/${repo.name}`;
      const description = buildDescription(repo);
      const pubDate = new Date(repo.created_at).toUTCString();

      return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      ${repo.language ? `<category>${escapeXml(repo.language)}</category>` : ''}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>GitHub Trends TR — Türkçe Trending Analizi</title>
    <link>${siteUrl}</link>
    <description>GitHub'da trend olan açık kaynak projelerin Türkçe AI analizleri. Günlük, haftalık ve aylık trending repolar.</description>
    <language>tr</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
    ${snapshotDate ? `<pubDate>${new Date(snapshotDate).toUTCString()}</pubDate>` : ''}
    <ttl>1440</ttl>
    <managingEditor>noreply@softween.com (Softween)</managingEditor>
    <webMaster>noreply@softween.com (Softween)</webMaster>
    <image>
      <url>${siteUrl}/favicon.svg</url>
      <title>GitHub Trends TR</title>
      <link>${siteUrl}</link>
    </image>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
