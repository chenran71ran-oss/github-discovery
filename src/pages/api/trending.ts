import type { APIRoute } from 'astro';
import { getLatestSnapshot, getReposBySnapshot, getReposByLanguage } from '../../lib/db';

export const GET: APIRoute = async ({ url, locals }) => {
  const db = (locals as any).runtime.env.DB as D1Database;
  const period = url.searchParams.get('period') as 'daily' | 'weekly' | 'monthly' | null;
  const language = url.searchParams.get('language');

  const snapshot = await getLatestSnapshot(db);
  if (!snapshot) {
    return new Response(JSON.stringify({ error: 'No data available' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let repos;
  if (language) {
    repos = await getReposByLanguage(db, snapshot.id, language);
  } else {
    repos = await getReposBySnapshot(db, snapshot.id, period ?? undefined);
  }

  // Strip readme field to reduce payload
  const data = repos.map(r => ({
    rank: r.rank,
    fullName: r.full_name,
    owner: r.owner,
    name: r.name,
    description: r.description,
    language: r.language,
    stars: r.stars,
    forks: r.forks,
    periodStars: r.period_stars,
    periodLabel: r.period_label,
    period: r.period,
    url: r.url,
    summary: r.parsedSummary,
    meta: r.parsedMeta,
  }));

  return new Response(JSON.stringify({
    date: snapshot.date,
    count: data.length,
    repos: data,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
