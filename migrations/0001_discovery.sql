CREATE TABLE IF NOT EXISTS discovery_repos (
 full_name TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', language TEXT NOT NULL DEFAULT '', topics TEXT NOT NULL DEFAULT '[]',
 homepage TEXT NOT NULL DEFAULT '', license TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT '', pushed_at TEXT NOT NULL DEFAULT '',
 readme TEXT, readme_hash TEXT, summary TEXT, summary_status TEXT NOT NULL DEFAULT 'pending',
 summary_version TEXT, summary_at TEXT, summary_attempt_at TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS discovery_snapshots (
 id TEXT PRIMARY KEY, period TEXT NOT NULL CHECK(period IN ('daily','weekly','monthly')), captured_at TEXT NOT NULL,
 source TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('building','ready')), repo_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS discovery_snapshots_lookup ON discovery_snapshots(period,status,captured_at DESC);
CREATE TABLE IF NOT EXISTS discovery_entries (
 snapshot_id TEXT NOT NULL REFERENCES discovery_snapshots(id), full_name TEXT NOT NULL REFERENCES discovery_repos(full_name),
 rank INTEGER NOT NULL, stars INTEGER NOT NULL, forks INTEGER NOT NULL, period_stars INTEGER NOT NULL, PRIMARY KEY(snapshot_id,full_name)
);
CREATE TABLE IF NOT EXISTS discovery_metrics (
 full_name TEXT NOT NULL REFERENCES discovery_repos(full_name), captured_at TEXT NOT NULL, stars INTEGER NOT NULL, forks INTEGER NOT NULL,
 PRIMARY KEY(full_name,captured_at)
);
CREATE INDEX IF NOT EXISTS discovery_metrics_time ON discovery_metrics(captured_at DESC,full_name);
CREATE TABLE IF NOT EXISTS discovery_jobs (
 id TEXT PRIMARY KEY, status TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT,
 published INTEGER NOT NULL DEFAULT 0, summarized INTEGER NOT NULL DEFAULT 0, error TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS discovery_one_running_job ON discovery_jobs(status) WHERE status='running';
