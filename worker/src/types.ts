export interface Env {
  DB: D1Database;
  AI?: Ai;
  GITHUB_TOKEN?: string;
  TRIGGER_SECRET?: string;
  AI_MODEL?: string;
  AI_BATCH_SIZE?: string;
  META_BATCH_SIZE?: string;
}
