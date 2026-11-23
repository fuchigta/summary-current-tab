import { fileURLToPath } from "node:url"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    // tsconfig の "~*": ["./src/*"] に合わせる
    alias: [
      {
        find: /^~(.*)$/,
        replacement: fileURLToPath(new URL("./src/$1", import.meta.url))
      }
    ]
  },
  test: {
    // vitest 4 から既定の exclude が node_modules と .git だけになったため、
    // plasmo の生成物を明示的に除外する
    exclude: [...configDefaults.exclude, "build/**", ".plasmo/**"]
  }
})
