import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { AIMessage } from "@langchain/core/messages"
import type { ChatResult } from "@langchain/core/outputs"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatOpenAI } from "@langchain/openai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ZodError } from "zod"

import { ResponseFormat, ResponseFormatJsonSchema } from "~lib/summarize"

// LLM が JSON を返したことにする ChatResult
function fakeResult(body: unknown): ChatResult {
  const text = JSON.stringify(body)
  return { generations: [{ text, message: new AIMessage(text) }] }
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
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("markdown を必須の文字列として表す", () => {
    expect(ResponseFormatJsonSchema).toMatchObject({
      type: "object",
      properties: {
        markdown: { type: "string", description: "マークダウン形式の要約" }
      },
      required: ["markdown"]
    })
  })

  // LLM の呼び出し口 (_generate) をモックし、実際に API へ送られる
  // structured output 用のオプションにスキーマが入っていることを確かめる
  type Case = [
    string,
    () => BaseChatModel,
    (options: Record<string, any>) => any
  ]

  it.each<Case>([
    [
      "Google",
      () => new ChatGoogleGenerativeAI({ model: "gemini", apiKey: "dummy" }),
      (options) => options.responseSchema
    ],
    [
      "OpenAI",
      () => new ChatOpenAI({ model: "gpt-4o", apiKey: "dummy" }),
      (options) => options.response_format.json_schema.schema
    ]
  ])(
    "%s の structured output にスキーマが渡り、結果がパースされる",
    async (_, createLLM, getSchema) => {
      const llm = createLLM()
      // OpenAI は withStructuredOutput で自身を複製するため、prototype をモックする
      const generate = vi
        .spyOn(Object.getPrototypeOf(llm), "_generate")
        .mockResolvedValue(fakeResult({ markdown: "# 要約" }))

      const res = await llm
        .withStructuredOutput(ResponseFormatJsonSchema)
        .invoke([["human", "hi"]])

      expect(res).toEqual({ markdown: "# 要約" })
      expect(
        getSchema(generate.mock.calls[0][1] as Record<string, any>).properties
          .markdown
      ).toEqual({
        type: "string",
        description: "マークダウン形式の要約"
      })
    }
  )
})
