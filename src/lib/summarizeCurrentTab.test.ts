import { AIMessage } from "@langchain/core/messages"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import {
  AzureChatOpenAICompletions,
  ChatOpenAI,
  ChatOpenAICompletions
} from "@langchain/openai"
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
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(ChatOpenAI.prototype, "_generate").mockImplementation(async () => {
      const text = JSON.stringify({ summary: "markdown がない" })
      return { generations: [{ text, message: new AIMessage(text) }] }
    })

    await expect(summarizeCurrentTab()).rejects.toThrow("llm invoke failed")

    // 投げ直すエラーには元の原因が残らないので、原因はコンソールに出しておく
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith(expect.any(Error))
  })

  it("現在のウィンドウのアクティブなタブからページの内容を取り出す", async () => {
    vi.spyOn(ChatOpenAI.prototype, "_generate").mockImplementation(async () => {
      const text = JSON.stringify({ markdown: "# 要約結果" })
      return { generations: [{ text, message: new AIMessage(text) }] }
    })

    await summarizeCurrentTab()

    expect(chrome.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true
    })
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 1 },
      func: expect.any(Function)
    })
  })

  it("箇条書き・コードブロック・区切り線を markdown にしてプロンプトに入れる", async () => {
    vi.stubGlobal("chrome", {
      tabs: { query: vi.fn().mockResolvedValue([{ id: 1 }]) },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([
          {
            result: {
              title: "テストページ",
              content:
                "<article>" +
                "<ul><li>項目1</li><li>項目2</li></ul>" +
                "<pre><code>const x = 1</code></pre>" +
                "<p>前の段落</p><hr><p>後の段落</p>" +
                "</article>"
            }
          }
        ])
      }
    })
    const generate = vi
      .spyOn(ChatOpenAI.prototype, "_generate")
      .mockImplementation(async () => {
        const text = JSON.stringify({ markdown: "# 要約結果" })
        return { generations: [{ text, message: new AIMessage(text) }] }
      })

    await summarizeCurrentTab()

    const [messages] = generate.mock.calls[0]
    const prompt = String(messages[0].content)
    // 箇条書きの記号は "-"（turndown の既定は "*"）
    expect(prompt).toContain("-   項目1\n-   項目2")
    // コードブロックはフェンス（turndown の既定はインデント）
    expect(prompt).toContain("```\nconst x = 1\n```")
    // 区切り線は "---"（turndown の既定は "* * *"）。プロンプトの定型文にも "---" があるので、
    // 前後の段落ごと確かめる
    expect(prompt).toContain("前の段落\n\n---\n\n後の段落")
  })

  it("未知のプロバイダはエラーにする", async () => {
    settings.provider = "unknown"
    await expect(summarizeCurrentTab()).rejects.toThrow("unknown provider")
  })

  // withStructuredOutput は new ChatOpenAI(this.fields) で複製するため、Azure でも
  // 呼び出し口の ChatOpenAI は素の ChatOpenAI になる。プロバイダごとの設定は複製に
  // 引き継がれる completions（Chat Completions API の実装）が持つので、そこをモックする
  it("OpenAI は Storage の model と apiKey で ChatOpenAI を作る", async () => {
    let llm: ChatOpenAICompletions
    vi.spyOn(ChatOpenAICompletions.prototype, "_generate").mockImplementation(
      async function (this: ChatOpenAICompletions) {
        llm = this
        const text = JSON.stringify({ markdown: "# OpenAI" })
        return { generations: [{ text, message: new AIMessage(text) }] }
      }
    )

    await expect(summarizeCurrentTab()).resolves.toBe("# OpenAI")

    // AzureChatOpenAICompletions は ChatOpenAICompletions のサブクラスなので、クラスを厳密に比べる
    expect(llm.constructor).toBe(ChatOpenAICompletions)
    expect(llm.model).toBe("gpt-4o")
    expect(llm.apiKey).toBe("dummy")
  })

  it("Google は Storage の model と apiKey で ChatGoogleGenerativeAI を作る", async () => {
    Object.assign(settings, {
      provider: "google",
      model: "gemini-2.0-flash",
      apiKey: "google-key"
    })
    let llm: ChatGoogleGenerativeAI
    vi.spyOn(ChatGoogleGenerativeAI.prototype, "_generate").mockImplementation(
      async function (this: ChatGoogleGenerativeAI) {
        llm = this
        const text = JSON.stringify({ markdown: "# Google" })
        return { generations: [{ text, message: new AIMessage(text) }] }
      }
    )

    await expect(summarizeCurrentTab()).resolves.toBe("# Google")

    expect(llm.model).toBe("gemini-2.0-flash")
    expect(llm.apiKey).toBe("google-key")
  })

  it("Azure OpenAI は Storage の model・apiKey・apiVersion・basePath で AzureChatOpenAI を作る", async () => {
    Object.assign(settings, {
      provider: "azure-openai",
      model: "my-deployment",
      apiKey: "azure-key",
      apiVersion: "2024-10-21",
      basePath: "https://example.openai.azure.com/openai/deployments"
    })
    let llm: AzureChatOpenAICompletions
    vi.spyOn(
      AzureChatOpenAICompletions.prototype,
      "_generate"
    ).mockImplementation(async function (this: AzureChatOpenAICompletions) {
      llm = this
      const text = JSON.stringify({ markdown: "# Azure" })
      return { generations: [{ text, message: new AIMessage(text) }] }
    })

    await expect(summarizeCurrentTab()).resolves.toBe("# Azure")

    expect(llm.constructor).toBe(AzureChatOpenAICompletions)
    expect(llm.model).toBe("my-deployment")
    expect(llm.apiKey).toBe("azure-key")
    expect(llm.azureOpenAIApiDeploymentName).toBe("my-deployment")
    expect(llm.azureOpenAIApiKey).toBe("azure-key")
    expect(llm.azureOpenAIApiVersion).toBe("2024-10-21")
    expect(llm.azureOpenAIBasePath).toBe(
      "https://example.openai.azure.com/openai/deployments"
    )
  })
})
