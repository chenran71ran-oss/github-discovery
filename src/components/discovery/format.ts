/** 北京时间的「月/日 时:分」 */
export function time(date: string) {
  return new Date(date).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
}
