import { AIMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { summarizeCurrentTab } from "~lib/summarize"

const settings: Record<string, string> = {}

vi.mock("@plasmohq/storage", () => ({
  Storage: class {
    async get(key: string) {
      return settings[key]
    }
  }
}))

describe("summarizeCurrentTab", () => {
  beforeEach(() => {
    Object.assign(settings, {
      provider: "openai",
      model: "gpt-4o",
      apiKey: "dummy"
    })
    vi.stubGlobal("chrome", {
      tabs: { query: vi.fn().mockResolvedValue([{ id: 1 }]) },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([
          {
            result: {
              title: "テストページ",
              content: "<article><h1>見出し</h1><p>本文です。</p></article>"
            }
          }
        ])
      }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("モックした LLM の structured output から markdown を取り出す", async () => {
    const generate = vi
      .spyOn(ChatOpenAI.prototype, "_generate")
      .mockImplementation(async () => {
        const text = JSON.stringify({ markdown: "# 要約結果" })
        return { generations: [{ text, message: new AIMessage(text) }] }
      })

    await expect(summarizeCurrentTab()).resolves.toBe("# 要約結果")

    // ページの HTML は turndown で markdown にしてからプロンプトに入る
    const [messages] = generate.mock.calls[0]
    const prompt = String(messages[0].content)
    expect(prompt).toContain("タイトル：テストページ")
    expect(prompt).toContain("# 見出し")
    expect(prompt).toContain("本文です。")
  })

  it("LLM が期待しない形を返したらエラーにする", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(ChatOpenAI.prototype, "_generate").mockImplementation(async () => {
      const text = JSON.stringify({ summary: "markdown がない" })
      return { generations: [{ text, message: new AIMessage(text) }] }
    })

    await expect(summarizeCurrentTab()).rejects.toThrow("llm invoke failed")
  })

  it("未知のプロバイダはエラーにする", async () => {
    settings.provider = "unknown"
    await expect(summarizeCurrentTab()).rejects.toThrow("unknown provider")
  })
})
