import type { Period, TrendingRepo } from "../../../shared/contracts";
export async function publishSnapshot(
  db: D1Database,
  period: Period,
  repos: TrendingRepo[],
  source: string,
  capturedAt: string,
): Promise<string> {
  if (repos.length < 5) throw new Error("Refusing incomplete snapshot");
  const id = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [];
  statements.push(
    db
      .prepare(
        "INSERT INTO discovery_snapshots(id,period,captured_at,source,status,repo_count) VALUES(?,?,?,?,'building',?)",
      )
      .bind(id, period, capturedAt, source, repos.length),
  );
  for (const repo of repos) {
    statements.push(
      db
        .prepare(
          `INSERT INTO discovery_repos(full_name,owner,name,description,language,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(full_name) DO UPDATE SET description=excluded.description,language=excluded.language,updated_at=excluded.updated_at`,
        )
        .bind(
          repo.fullName,
          repo.owner,
          repo.name,
          repo.description,
          repo.language,
          capturedAt,
        ),
    );
    statements.push(
      db
        .prepare(
          "INSERT INTO discovery_entries(snapshot_id,full_name,rank,stars,forks,period_stars) VALUES(?,?,?,?,?,?)",
        )
        .bind(
          id,
          repo.fullName,
          repo.rank,
          repo.stars,
          repo.forks,
          repo.periodStars,
        ),
    );
  }
  statements.push(
    db
      .prepare("UPDATE discovery_snapshots SET status='ready' WHERE id=?")
      .bind(id),
  );
  // D1 batch is transactional. Readers see either the previous complete snapshot or this one.
  await db.batch(statements);
  return id;
}
