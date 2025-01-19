import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { marked } from "marked";
import { useEffect, useState } from "react";
import TurndownService from "turndown";
import { Storage } from "@plasmohq/storage"
import "~style.css";
import { LLMProvider } from "~options";
import { AzureChatOpenAI, ChatOpenAI } from "@langchain/openai";

function getPageContent() {
  const doc = document.cloneNode(true) as Document;

  doc.querySelectorAll('style, script, link, meta, iframe, img, svg, noscript, form, button, input, select, *:empty, aside, nav, header, footer')
    .forEach(el => el.remove());

  doc.querySelectorAll('a')
    .forEach(a => {
      if (!a.textContent.trim()) {
        a.remove();
      }
    })

  const element = doc.querySelector('article') || doc.body;

  return {
    title: doc.title,
    content: element.outerHTML
  };
}

async function summarizeTextByLLM(title: string, text: string) {
  const storage = new Storage();

  let llm;

  switch (await storage.get('provider') as LLMProvider) {
    case LLMProvider.GOOGLE:
      llm = new ChatGoogleGenerativeAI({
        model: await storage.get('model'),
        apiKey: await storage.get('apiKey')
      });
      break;
    case LLMProvider.OPENAI:
      llm = new ChatOpenAI({
        model: await storage.get('model'),
        apiKey: await storage.get('apiKey')
      })
      break;
    case LLMProvider.AZURE_OPENAI:
      llm = new AzureChatOpenAI({
        model: await storage.get('model'),
        apiKey: await storage.get('apiKey'),
        azureOpenAIApiDeploymentName: await storage.get('model'),
        azureOpenAIApiKey: await storage.get('apiKey'),
        azureOpenAIApiVersion: await storage.get('apiVersion'),
        azureOpenAIBasePath: await storage.get('basePath'),
      })
      break;
    default:
      throw new Error("unknown provider");
  }

  const res = await llm.invoke([
    [
      "human",
      `
      以下のWebページの文章を要約してください。

      - Webページ全体の文章なので、広告や不要なコンテンツが含まれる可能性があります。以下の制約を遵守してください。
        - メインコンテンツだと思われる部分のみを要約してください。
        - メインコンテンツ以外の省略した部分については言及しないでください。
      - メインコンテンツの重要な部分についてまとめてください。以下の制約を遵守してください。
        - 出力はマークダウン形式としてください。
        - 箇条書きや表などを利用して、わかりやすくまとめてください。
        - 文体は「ですます」調としてください。

      ---

      タイトル：${title}

      ===

      ${text}
      `
    ]
  ]);

  return res.content as string;
}

async function summarizeCurrentTab() {
  const [tab] = await chrome.tabs.query(
    {
      active: true,
      currentWindow: true
    }
  );

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: getPageContent,
  });

  const service = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    hr: '---'
  });

  const res = await summarizeTextByLLM(result.title, service.turndown(result.content));

  return marked(res, { async: false });
}

function IndexPopup() {
  const [summary, setSummary] = useState('');

  useEffect(() => {
    summarizeCurrentTab().then((res) => setSummary(res));
  }, []);

  return (
    <div className="flex flex-col w-[600px] text-lg text-gray-700 overflow-auto p-4">
      {summary
        ? <div className="markdown" dangerouslySetInnerHTML={{ __html: summary }} />
        : <>Loading...</>}
    </div>
  )
}

export default IndexPopup
