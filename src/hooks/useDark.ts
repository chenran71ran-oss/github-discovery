import { useMemo } from "react"
import { useMedia, useUpdateEffect } from "react-use"

export declare type ColorScheme = "dark" | "light" | "auto"

// getOnInit：首帧就读出用户存的明暗设置，浅色用户不会先看到一帧深色再渐变过去
const colorSchemeAtom = atomWithStorage("color-scheme", "dark", undefined, { getOnInit: true })

export function useDark() {
  const [colorScheme, setColorScheme] = useAtom(colorSchemeAtom)
  const prefersDarkMode = useMedia("(prefers-color-scheme: dark)")
  const isDark = useMemo(() => colorScheme === "auto" ? prefersDarkMode : colorScheme === "dark", [colorScheme, prefersDarkMode])

  useUpdateEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
  }, [isDark])

  const setDark = (value: ColorScheme) => {
    setColorScheme(value)
  }

  const toggleDark = () => {
    setColorScheme(isDark ? "light" : "dark")
  }

  return { isDark, colorScheme: colorScheme as ColorScheme, setDark, toggleDark }
}
