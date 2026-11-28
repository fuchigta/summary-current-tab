// @vitest-environment jsdom
import { AIMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { summarizeCurrentTab } from "~lib/summarize"

// getPageContent は export されておらず、chrome.scripting.executeScript の func として
// タブに注入される。ここでは executeScript のモックが受け取った func をこのテストの
// document で実際に実行し、その戻り値（タブから返る結果）を確かめる。

vi.mock("@plasmohq/storage", () => ({
  Storage: class {
    async get(key: string) {
      return { provider: "openai", model: "gpt-4o", apiKey: "dummy" }[key]
    }
  }
}))

type PageContent = { title: string; content: string }

let pageContent: PageContent

beforeEach(() => {
  vi.stubGlobal("chrome", {
    tabs: { query: vi.fn().mockResolvedValue([{ id: 1 }]) },
    scripting: {
      executeScript: vi.fn(async ({ func }: { func: () => PageContent }) => {
        pageContent = func()
        return [{ result: pageContent }]
      })
    }
  })
  vi.spyOn(ChatOpenAI.prototype, "_generate").mockImplementation(async () => {
    const text = JSON.stringify({ markdown: "# 要約" })
    return { generations: [{ text, message: new AIMessage(text) }] }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.title = ""
  document.body.innerHTML = ""
})

describe("getPageContent", () => {
  it("ページのタイトルを返す", async () => {
    document.title = "テストページ"
    document.body.innerHTML = "<p>本文</p>"

    await summarizeCurrentTab()

    expect(pageContent.title).toBe("テストページ")
  })

  it("本文以外の要素を取り除いた body を返す", async () => {
    document.body.innerHTML =
      "<style>p { color: red; }</style>" +
      "<script>console.log('script')</script>" +
      '<link rel="stylesheet" href="style.css">' +
      '<meta name="description" content="説明">' +
      '<iframe src="https://example.com/ad"></iframe>' +
      '<svg><circle r="1"></circle></svg>' +
      "<noscript>JavaScript を有効にしてください</noscript>" +
      "<header>ヘッダー</header>" +
      "<nav>ナビゲーション</nav>" +
      "<form><p>フォーム</p><input><button>送信</button>" +
      "<select><option>選択肢</option></select></form>" +
      "<p>本文</p>" +
      "<aside>サイドバー</aside>" +
      "<footer>フッター</footer>"

    await summarizeCurrentTab()

    expect(pageContent.content).toBe("<body><p>本文</p></body>")
  })

  it("中身が空の要素を取り除く", async () => {
    document.body.innerHTML = "<div></div><p>本文</p><span></span>"

    await summarizeCurrentTab()

    expect(pageContent.content).toBe("<body><p>本文</p></body>")
  })

  it("文字を含まないリンクを取り除き、文字を含むリンクは残す", async () => {
    document.body.innerHTML =
      '<p>本文<a href="/empty">  </a><a href="/link">リンク</a></p>'

    await summarizeCurrentTab()

    expect(pageContent.content).toBe(
      '<body><p>本文<a href="/link">リンク</a></p></body>'
    )
  })

  it("article が 1 件だけならその article を返す", async () => {
    document.body.innerHTML =
      "<div><p>関連記事</p></div><article><p>記事本文</p></article>"

    await summarizeCurrentTab()

    expect(pageContent.content).toBe("<article><p>記事本文</p></article>")
  })

  it("article が複数あれば body 全体を返す", async () => {
    document.body.innerHTML =
      "<article><p>記事1</p></article><article><p>記事2</p></article>"

    await summarizeCurrentTab()

    expect(pageContent.content).toBe(
      "<body><article><p>記事1</p></article><article><p>記事2</p></article></body>"
    )
  })

  it("タブの document 自体は書き換えない", async () => {
    document.body.innerHTML = "<nav>ナビゲーション</nav><p>本文</p>"

    await summarizeCurrentTab()

    expect(document.body.innerHTML).toBe("<nav>ナビゲーション</nav><p>本文</p>")
  })
})
