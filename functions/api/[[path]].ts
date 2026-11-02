import { json } from "../../edge/http"

/** 未定义的 /api 路径返回 404，而不是落到单页应用的 index.html */
export function onRequest() {
  return json({ error: "not found" }, 404)
}
