export interface RepoRow {
  id: string;
  snapshot_id: string;
  period: 'daily' | 'weekly' | 'monthly';
  rank: number;
  full_name: string;
  owner: string;
  name: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  period_stars: number;
  period_label: string;
  url: string;
  readme: string | null;
  ai_summary: string | null;
  repo_meta: string | null;
  created_at: string;
}

export interface SnapshotRow {
  id: string;
  date: string;
  repo_count: number;
  created_at: string;
}

export interface RepoMetaParsed {
  openIssues: number;
  license: string;
  lastPush: string;
  createdAt: string;
  topics: string[];
  homepage: string;
  watchers: number;
}

export interface ParsedRepo extends RepoRow {
  parsedSummary: {
    summary: string;
    targetAudience: string;
    highlights: string[];
    usageExample?: string;
  } | null;
  parsedMeta: RepoMetaParsed | null;
}

function parseRepo(row: RepoRow): ParsedRepo {
  let parsedSummary = null;
  if (row.ai_summary) {
    try {
      parsedSummary = JSON.parse(row.ai_summary);
    } catch {
      parsedSummary = null;
    }
  }
  let parsedMeta = null;
  if (row.repo_meta) {
    try {
      parsedMeta = JSON.parse(row.repo_meta);
    } catch {
      parsedMeta = null;
    }
  }
  return { ...row, parsedSummary, parsedMeta };
}

export async function getLatestSnapshot(db: D1Database): Promise<SnapshotRow | null> {
  const result = await db
    .prepare('SELECT * FROM trending_snapshots ORDER BY date DESC LIMIT 1')
    .first<SnapshotRow>();
  return result;
}

export async function getSnapshotByDate(db: D1Database, date: string): Promise<SnapshotRow | null> {
  const result = await db
    .prepare('SELECT * FROM trending_snapshots WHERE date = ?')
    .bind(date)
    .first<SnapshotRow>();
  return result;
}

export async function getReposBySnapshot(
  db: D1Database,
  snapshotId: string,
  period?: 'daily' | 'weekly' | 'monthly',
): Promise<ParsedRepo[]> {
  let query = 'SELECT * FROM trending_repos WHERE snapshot_id = ?';
  const binds: string[] = [snapshotId];

  if (period) {
    query += ' AND period = ?';
    binds.push(period);
  }

  query += ' ORDER BY period, rank';

  const stmt = db.prepare(query);
  const result = await stmt.bind(...binds).all<RepoRow>();

  return (result.results ?? []).map(parseRepo);
}

export async function getRepoByName(
  db: D1Database,
  owner: string,
  name: string,
): Promise<ParsedRepo | null> {
  const result = await db
    .prepare(
      'SELECT * FROM trending_repos WHERE owner = ? AND name = ? ORDER BY created_at DESC LIMIT 1',
    )
    .bind(owner, name)
    .first<RepoRow>();

  return result ? parseRepo(result) : null;
}

export async function getRepoHistory(
  db: D1Database,
  fullName: string,
): Promise<Array<{ date: string; period: string; rank: number; stars: number }>> {
  const result = await db
    .prepare(
      `SELECT s.date, r.period, r.rank, r.stars
       FROM trending_repos r
       JOIN trending_snapshots s ON r.snapshot_id = s.id
       WHERE r.full_name = ?
       ORDER BY s.date DESC
       LIMIT 30`,
    )
    .bind(fullName)
    .all<{ date: string; period: string; rank: number; stars: number }>();

  return result.results ?? [];
}

export async function getAvailableDates(db: D1Database): Promise<SnapshotRow[]> {
  const result = await db
    .prepare('SELECT * FROM trending_snapshots ORDER BY date DESC LIMIT 30')
    .all<SnapshotRow>();
  return result.results ?? [];
}

export async function getReposByLanguage(
  db: D1Database,
  snapshotId: string,
  language: string,
): Promise<ParsedRepo[]> {
  const result = await db
    .prepare('SELECT * FROM trending_repos WHERE snapshot_id = ? AND LOWER(language) = LOWER(?) ORDER BY period, rank')
    .bind(snapshotId, language)
    .all<RepoRow>();
  return (result.results ?? []).map(parseRepo);
}

export async function getLanguageStats(
  db: D1Database,
  snapshotId: string,
): Promise<Array<{ language: string; count: number }>> {
  const result = await db
    .prepare("SELECT language, COUNT(*) as count FROM trending_repos WHERE snapshot_id = ? AND language != '' GROUP BY language ORDER BY count DESC")
    .bind(snapshotId)
    .all<{ language: string; count: number }>();
  return result.results ?? [];
}

export async function searchRepos(
  db: D1Database,
  query: string,
  limit: number = 30,
): Promise<ParsedRepo[]> {
  const pattern = `%${query}%`;
  const result = await db
    .prepare(
      `SELECT * FROM trending_repos
       WHERE (full_name LIKE ? OR description LIKE ? OR ai_summary LIKE ?)
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(pattern, pattern, pattern, limit)
    .all<RepoRow>();
  return (result.results ?? []).map(parseRepo);
}

export async function getTwoSnapshots(
  db: D1Database,
): Promise<{ today: SnapshotRow | null; yesterday: SnapshotRow | null }> {
  const result = await db
    .prepare('SELECT * FROM trending_snapshots ORDER BY date DESC LIMIT 2')
    .all<SnapshotRow>();
  const rows = result.results ?? [];
  return { today: rows[0] ?? null, yesterday: rows[1] ?? null };
}

export async function getRisingStars(
  db: D1Database,
  snapshotId: string,
): Promise<ParsedRepo[]> {
  // Repos with < 5000 stars but high period_stars (fast-growing small projects)
  const result = await db
    .prepare(
      `SELECT * FROM trending_repos
       WHERE snapshot_id = ? AND stars < 5000 AND period_stars > 100
       ORDER BY CAST(period_stars AS FLOAT) / CAST(stars AS FLOAT) DESC
       LIMIT 10`
    )
    .bind(snapshotId)
    .all<RepoRow>();
  return (result.results ?? []).map(parseRepo);
}

export async function getReposByCategory(
  db: D1Database,
  snapshotId: string,
  category: string,
): Promise<ParsedRepo[]> {
  const result = await db
    .prepare(
      `SELECT * FROM trending_repos
       WHERE snapshot_id = ? AND ai_summary LIKE ?
       ORDER BY period, rank`
    )
    .bind(snapshotId, `%"category":"${category}"%`)
    .all<RepoRow>();
  return (result.results ?? []).map(parseRepo);
}

export async function getCategoryStats(
  db: D1Database,
  snapshotId: string,
): Promise<Array<{ category: string; count: number }>> {
  // Parse categories from ai_summary JSON
  const result = await db
    .prepare('SELECT ai_summary FROM trending_repos WHERE snapshot_id = ? AND ai_summary IS NOT NULL')
    .bind(snapshotId)
    .all<{ ai_summary: string }>();

  const counts: Record<string, number> = {};
  for (const row of result.results ?? []) {
    try {
      const parsed = JSON.parse(row.ai_summary);
      const cat = parsed.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    } catch { /* skip */ }
  }

  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export interface BlogPostRow {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  date: string;
  type: string;
  created_at: string;
}

export async function getBlogPosts(
  db: D1Database,
  limit: number = 20,
): Promise<BlogPostRow[]> {
  const result = await db
    .prepare('SELECT * FROM blog_posts ORDER BY date DESC LIMIT ?')
    .bind(limit)
    .all<BlogPostRow>();
  return result.results ?? [];
}

export async function getBlogPostBySlug(
  db: D1Database,
  slug: string,
): Promise<BlogPostRow | null> {
  return db
    .prepare('SELECT * FROM blog_posts WHERE slug = ?')
    .bind(slug)
    .first<BlogPostRow>();
}

export async function getWeeklyReport(
  db: D1Database,
): Promise<{ snapshots: SnapshotRow[]; topRepos: Array<ParsedRepo & { appearances: number }> }> {
  // Get last 7 days of snapshots
  const snapshots = await db
    .prepare('SELECT * FROM trending_snapshots ORDER BY date DESC LIMIT 7')
    .all<SnapshotRow>();

  // Get most appearing repos across last 7 days
  const topRepos = await db
    .prepare(
      `SELECT r.*, COUNT(*) as appearances FROM trending_repos r
       JOIN trending_snapshots s ON r.snapshot_id = s.id
       WHERE s.date >= date('now', '-7 days')
       GROUP BY r.full_name
       ORDER BY appearances DESC, r.stars DESC
       LIMIT 15`
    )
    .all<RepoRow & { appearances: number }>();

  return {
    snapshots: snapshots.results ?? [],
    topRepos: (topRepos.results ?? []).map(row => ({ ...parseRepo(row), appearances: row.appearances })),
  };
}

export async function getLanguageTrends(
  db: D1Database,
): Promise<Array<{ date: string; language: string; count: number }>> {
  const result = await db
    .prepare(
      `SELECT s.date, r.language, COUNT(*) as count
       FROM trending_repos r
       JOIN trending_snapshots s ON r.snapshot_id = s.id
       WHERE r.language != '' AND s.date >= date('now', '-7 days')
       GROUP BY s.date, r.language
       ORDER BY s.date, count DESC`
    )
    .all<{ date: string; language: string; count: number }>();
  return result.results ?? [];
}

export async function getSimilarRepos(
  db: D1Database,
  repo: ParsedRepo,
  limit: number = 5,
): Promise<ParsedRepo[]> {
  const result = await db
    .prepare(
      `SELECT * FROM trending_repos
       WHERE language = ? AND full_name != ?
       ORDER BY created_at DESC, stars DESC
       LIMIT ?`
    )
    .bind(repo.language, repo.full_name, limit)
    .all<RepoRow>();
  return (result.results ?? []).map(parseRepo);
}

export async function addSubscriber(
  db: D1Database,
  email: string,
  consentIp: string,
): Promise<{ status: 'confirm' | 'already' | 'error'; confirmToken?: string }> {
  const confirmToken = crypto.randomUUID().replace(/-/g, '');
  const unsubToken = crypto.randomUUID().replace(/-/g, '');
  const id = `sub_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  try {
    await db
      .prepare(
        `INSERT INTO subscribers (id, email, unsubscribe_token, confirm_token, confirmed, active, consent_ip)
         VALUES (?, ?, ?, ?, 0, 1, ?)
         ON CONFLICT(email) DO UPDATE SET
           active = 1,
           unsubscribed_at = NULL,
           consent_ip = excluded.consent_ip,
           unsubscribe_token = COALESCE(subscribers.unsubscribe_token, excluded.unsubscribe_token),
           confirm_token = CASE WHEN subscribers.confirmed = 1 THEN subscribers.confirm_token ELSE excluded.confirm_token END`,
      )
      .bind(id, email, unsubToken, confirmToken, consentIp)
      .run();
    const row = await db
      .prepare('SELECT confirmed, confirm_token FROM subscribers WHERE email = ?')
      .bind(email)
      .first<{ confirmed: number; confirm_token: string }>();
    if (!row) return { status: 'error' };
    if (row.confirmed === 1) return { status: 'already' };
    return { status: 'confirm', confirmToken: row.confirm_token };
  } catch {
    return { status: 'error' };
  }
}

export async function confirmSubscriber(db: D1Database, token: string): Promise<boolean> {
  if (!token) return false;
  const res = await db
    .prepare('UPDATE subscribers SET confirmed = 1, active = 1 WHERE confirm_token = ? AND confirmed = 0')
    .bind(token)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function deactivateSubscriber(db: D1Database, token: string): Promise<boolean> {
  if (!token) return false;
  const res = await db
    .prepare(
      "UPDATE subscribers SET active = 0, unsubscribed_at = datetime('now') WHERE unsubscribe_token = ? AND active = 1",
    )
    .bind(token)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}
