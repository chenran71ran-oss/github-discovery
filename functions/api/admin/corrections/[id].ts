/** 审核一条纠错：通过（对所有人生效）或驳回；也可以撤回已通过的（改为驳回） */
import { readJson, requireAdmin } from "../../../../edge/admin"
import { json, log } from "../../../../edge/http"
import type { Context } from "../../../../edge/types"

export async function onRequestPatch(ctx: Context) {
  const auth = await requireAdmin(ctx, true)
  if (auth instanceof Response) return auth
  const id = Number(ctx.params.id)
  const status = (await readJson(ctx.request)).status
  if (!Number.isInteger(id) || id <= 0 || (status !== "approved" && status !== "rejected")) return json({ error: "请求不正确" }, 400)
  const correction = await auth.store.getCorrection(id)
  if (!correction) return json({ error: "这条纠错不存在" }, 404)
  await auth.store.reviewCorrection(id, status, auth.actor.login, new Date().toISOString())
  log("admin.correction_reviewed", { by: auth.actor.login, id, status })
  return json({ ok: true })
}
