import { ourongxing } from "@ourongxing/eslint-config"

/** @type {import("eslint").Linter.Config[]} */
const config = await ourongxing({
  type: "app",
  // 貌似不能 ./ 开头，
  ignores: ["src/routeTree.gen.ts", "imports.app.d.ts", "public/", ".vscode", "**/*.json", "vr/"],
})

export default config
