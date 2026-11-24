/** 纠错审核：待审核列表与最近通过的；?format=export 导出给采集器（collector/corrections.json） */
import { requireAdmin } from "../../../../edge/admin"
import { applied, describe } from "../../../../edge/corrections"
import { json } from "../../../../edge/http"
import type { Context, Correction } from "../../../../edge/types"

const row = (r: Correction) => ({ id: r.id, kind: r.kind, repo: r.repo, ...describe(r), by: r.login, createdAt: r.created_at, status: r.status, reviewedBy: r.reviewed_by })

export async function onRequestGet(ctx: Context) {
  const auth = await requireAdmin(ctx, false)
  if (auth instanceof Response) return auth
  const approved = await auth.store.listCorrections("approved", 2000)
  if (new URL(ctx.request.url).searchParams.get("format") === "export") return json(applied(approved))
  return json({ pending: (await auth.store.listCorrections("pending")).map(row), approved: approved.slice(0, 30).map(row), approvedTotal: approved.length })
}
