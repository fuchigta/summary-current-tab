import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatOpenAI } from "@langchain/openai"
import { describe, expect, it } from "vitest"
import { ZodError } from "zod"

import { ResponseFormat, ResponseFormatJsonSchema } from "~lib/summarize"

// withStructuredOutput が返す Runnable から LLM に渡される tools を取り出す
function findTools(runnable: any): any[] | undefined {
  if (!runnable) return undefined
  return runnable.kwargs?.tools ?? findTools(runnable.bound ?? runnable.first)
}

describe("ResponseFormat", () => {
  it("markdown を持つレスポンスを受け付ける", () => {
    expect(ResponseFormat.parse({ markdown: "# 要約" })).toEqual({
      markdown: "# 要約"
    })
  })

  it("markdown が欠けている、または文字列でない場合は ZodError になる", () => {
    expect(() => ResponseFormat.parse({})).toThrow(ZodError)

    const result = ResponseFormat.safeParse({ markdown: 1 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(["markdown"])
  })
})

describe("ResponseFormatJsonSchema", () => {
  it("markdown を必須の文字列として表す", () => {
    expect(ResponseFormatJsonSchema).toMatchObject({
      type: "object",
      properties: {
        markdown: { type: "string", description: "マークダウン形式の要約" }
      },
      required: ["markdown"]
    })
  })

  type Case = [
    string,
    () => { withStructuredOutput(schema: Record<string, any>): unknown },
    (tools: any[]) => any
  ]

  it.each<Case>([
    [
      "Google",
      () => new ChatGoogleGenerativeAI({ model: "gemini", apiKey: "dummy" }),
      (tools: any[]) => tools[0].functionDeclarations[0].parameters
    ],
    [
      "OpenAI",
      () => new ChatOpenAI({ model: "gpt-4o", apiKey: "dummy" }),
      (tools: any[]) => tools[0].function.parameters
    ]
  ])("%s の structured output にスキーマが渡る", (_, createLLM, getParams) => {
    const tools = findTools(
      createLLM().withStructuredOutput(ResponseFormatJsonSchema)
    )

    expect(getParams(tools).properties.markdown).toEqual({
      type: "string",
      description: "マークダウン形式の要約"
    })
  })
})
