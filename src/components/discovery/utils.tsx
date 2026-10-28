export const time = (date: string) => new Date(date).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })

export function Icon({ name, className = "" }: { name: string, className?: string }) {
  return <span aria-hidden="true" className={`${name} ${className}`} />
}
