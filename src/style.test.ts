import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import postcss from "postcss"
import tailwindcss from "tailwindcss"
import { describe, expect, it } from "vitest"

describe("style.css", () => {
  it("postcss と tailwindcss で @tailwind と @apply が展開される", async () => {
    const from = fileURLToPath(new URL("./style.css", import.meta.url))

    const result = await postcss([tailwindcss()]).process(
      readFileSync(from, "utf8"),
      { from }
    )

    expect(result.css).not.toMatch(/@tailwind|@apply/)
    expect(result.css).toMatch(/\.markdown h1\s*\{[^}]*font-weight: 600/)
  })
})
