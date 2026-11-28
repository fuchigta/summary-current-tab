import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { AzureChatOpenAI, ChatOpenAI } from "@langchain/openai"
import TurndownService from "turndown"
import { z } from "zod"

import { Storage } from "@plasmohq/storage"

import { LLMProvider } from "~options"

function getPageContent() {
  const doc = document.cloneNode(true) as Document

  doc
    .querySelectorAll(
      "style, script, link, meta, iframe, svg, noscript, form, button, input, select, *:empty, aside, nav, header, footer"
    )
    .forEach((el) => el.remove())

  doc.querySelectorAll("a").forEach((a) => {
    if (!a.textContent.trim()) {
      a.remove()
    }
  })

  const articles = doc.querySelectorAll("article")

  const element = articles.length == 1 ? articles[0] : doc.body

  return {
    title: doc.title,
    content: element.outerHTML
  }
}

export const ResponseFormat = z.object({
  markdown: z.string().describe("マークダウン形式の要約")
})

// langchain の各プロバイダは zod v3 前提の zod-to-json-schema で変換するため、
// zod v4 のスキーマは JSON Schema に変換してから渡し、結果は zod で検証する
export const ResponseFormatJsonSchema = z.toJSONSchema(ResponseFormat)

async function summarizeTextByLLM(title: string, text: string) {
  const storage = new Storage()

  let llm

  switch ((await storage.get("provider")) as LLMProvider) {
    case LLMProvider.GOOGLE:
      llm = new ChatGoogleGenerativeAI({
        model: await storage.get("model"),
        apiKey: await storage.get("apiKey")
      })
      break
    case LLMProvider.OPENAI:
      llm = new ChatOpenAI({
        model: await storage.get("model"),
        apiKey: await storage.get("apiKey")
      })
      break
    case LLMProvider.AZURE_OPENAI:
      llm = new AzureChatOpenAI({
        model: await storage.get("model"),
        apiKey: await storage.get("apiKey"),
        azureOpenAIApiDeploymentName: await storage.get("model"),
        // Stryker disable next-line StringLiteral: 等価。azureOpenAIApiKey が無いと AzureChatOpenAI は同じ値の apiKey を使う
        azureOpenAIApiKey: await storage.get("apiKey"),
        azureOpenAIApiVersion: await storage.get("apiVersion"),
        azureOpenAIBasePath: await storage.get("basePath")
      })
      break
    default:
      throw new Error("unknown provider")
  }

  const structuredLLM = llm.withStructuredOutput(ResponseFormatJsonSchema)

  try {
    const res = await structuredLLM.invoke([
      [
        "human",
        `
        以下のWebページの文章を要約してください。

        - Webページ全体の文章なので、広告や不要なコンテンツが含まれる可能性があります。以下の制約を遵守してください。
          - メインコンテンツだと思われる部分のみを要約してください。
          - メインコンテンツ以外の省略した部分については言及しないでください。
        - メインコンテンツの重要な部分についてまとめてください。以下の制約を遵守してください。
          - 出力はマークダウン形式としてください。
          - 箇条書き、表、画像などを利用して、わかりやすくまとめてください。
          - 文体は「ですます」調としてください。

        ---

        タイトル：${title}

        ===

        ${text}
        `
      ]
    ])

    return ResponseFormat.parse(res).markdown
  } catch (e) {
    console.error(e)
    throw new Error("llm invoke failed")
  }
}

export async function summarizeCurrentTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: getPageContent
  })

  const service = new TurndownService({
    // Stryker disable next-line StringLiteral: 等価。turndown は "setext" 以外を atx として扱う
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    hr: "---"
  })

  const res = await summarizeTextByLLM(
    result.title,
    service.turndown(result.content)
  )

  return res
}
