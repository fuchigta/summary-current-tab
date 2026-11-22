import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    // tsconfig の "~*": ["./src/*"] に合わせる
    alias: [
      {
        find: /^~(.*)$/,
        replacement: fileURLToPath(new URL("./src/$1", import.meta.url))
      }
    ]
  }
})
