/** 第 1 层：账号模块的静态配置。 */

/** __Host- 前缀要求 Secure、Path=/ 且不能带 Domain，Cookie 不会被子域名覆盖 */
export const SESSION_COOKIE = "__Host-gb_session"
export const STATE_COOKIE = "__Host-gb_oauth"

/** 登录有效期 7 天 */
export const SESSION_TTL = 7 * 24 * 3600
/** 每 10 分钟回数据库核对一次成员状态：移除或封禁成员最迟 10 分钟后生效 */
export const RECHECK_AFTER = 10 * 60
/** 跳转 GitHub 授权到回来的最长时间 */
export const STATE_TTL = 10 * 60
/** 签名密钥的最短长度 */
export const MIN_SECRET_LENGTH = 32

/** 不登录也能访问的路径：登录页、登录接口和登录页用到的图标 */
export const PUBLIC_PATHS = new Set(["/login", "/favicon.ico", "/icon.svg", "/apple-touch-icon.png", "/robots.txt"])
export const PUBLIC_PREFIXES = ["/api/auth/"]

/** GitHub 用户名规则：字母数字和单个连字符，最长 39 位 */
export const GITHUB_LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i

export const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize"
export const GITHUB_TOKEN = "https://github.com/login/oauth/access_token"
export const GITHUB_API = "https://api.github.com"

/** 每人最多收藏的项目数，以及单条收藏（项目快照 JSON）的大小上限 */
export const MAX_FAVORITES = 1000
export const MAX_FAVORITE_BYTES = 16 * 1024
/** 仓库全名 owner/name：用户名只有字母数字和连字符，仓库名不能是 . 或 .. */
/** 「看过」记录：保留天数、每次最多上报几个、每人最多保留几条 */
export const SEEN_DAYS = 90
export const SEEN_BATCH = 100
export const MAX_SEEN = 5000
export const REPO_NAME = /^[a-z\d-]{1,39}\/(?!\.\.?$)[\w.-]{1,100}$/i
