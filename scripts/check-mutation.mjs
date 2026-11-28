// StrykerJS の JSON レポート（reports/mutation/mutation.json）を読み、
// 見逃し（Survived + NoCoverage）上限のラチェットで合否を決める。
//
// - Stryker は変異対象が 0 件でも終了コード 0 で終わる（空振り）。そのため、試された
//   ミュータントが 1 件以上あることと、stryker.config.mjs の mutate に書いたファイルが
//   すべてレポートに 1 件以上のミュータント付きで現れることも確かめる。
// - Ignored（// Stryker disable で除外した等価ミュータント）は見逃しにも分母にも数えない。
// - 上限は実測値。テストを足して見逃しが減ったら MAX_UNDETECTED も下げる。
import { readFileSync } from "node:fs"

import config from "../stryker.config.mjs"

const REPORT = "reports/mutation/mutation.json"

// 2026-11-28 の実測（導入時）: 生成 69 件（summarize.ts 56・background.ts 13）、
//   等価として除外 2 件、Killed 59・Survived 8・NoCoverage 0 → 上限 8
//   全件実行 3 回でミュータントごとの結果まで一致した。等価は除外済みで、残る 8 件は
//   すべてテストの穴（テストを足せば殺せることを確認済み）なので余裕は持たせない。
//   新しい等価ミュータントが出たら、上限を上げずに除外コメントで扱う。
const MAX_UNDETECTED = 8

function countStatuses(files) {
  const counts = {}
  const mutants = Object.values(files).flatMap((file) => file.mutants)
  for (const { status } of mutants) {
    counts[status] = (counts[status] ?? 0) + 1
  }
  return counts
}

function missingTargets(files) {
  return config.mutate.filter((file) => !(files[file]?.mutants.length > 0))
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

const { files } = JSON.parse(readFileSync(REPORT, "utf8"))

for (const [file, { mutants }] of Object.entries(files)) {
  console.log(`${file}: ${mutants.length} mutants`)
}

const counts = countStatuses(files)
console.log("status breakdown:", counts)

const missing = missingTargets(files)
if (missing.length > 0) {
  fail(`No mutants were generated for: ${missing.join(", ")}`)
}

const total = Object.values(counts).reduce((a, b) => a + b, 0)
const tested = total - (counts.Ignored ?? 0)
if (tested === 0) {
  fail("No mutants were tested. The mutate pattern may match nothing.")
}

const undetected = (counts.Survived ?? 0) + (counts.NoCoverage ?? 0)
console.log(
  `tested: ${tested}, undetected: ${undetected} (max ${MAX_UNDETECTED})`
)
if (undetected > MAX_UNDETECTED) {
  fail(
    `Undetected mutants increased: ${undetected} > ${MAX_UNDETECTED}. ` +
      "Add tests that kill the new survivors."
  )
}
