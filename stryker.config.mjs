// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: "pnpm",
  // pnpm の node_modules 構成では Stryker が @stryker-mutator/* を自動検出できないため、
  // 読み込むプラグインを明示する（Stryker 公式 troubleshooting の pnpm の項）。
  plugins: ["@stryker-mutator/vitest-runner"],
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.ts" },
  // 変異対象。scripts/check-mutation.mjs が各ファイルにミュータントがあることを
  // 確かめるので、glob ではなくファイルのパスで書く。
  // popup.tsx・options.tsx（React の UI）は対象外。テストに React の描画環境と
  // @plasmohq/storage/hook のモックが要るわりに、ミュータントの多くは className などの
  // 見た目の文字列になる（導入時の試算: options.tsx 19 件・popup.tsx 13 件）。
  mutate: ["src/lib/summarize.ts", "src/background.ts"],
  reporters: ["clear-text", "progress", "json"],
  coverageAnalysis: "perTest",
  tempDirName: ".stryker-tmp"
}
export default config
