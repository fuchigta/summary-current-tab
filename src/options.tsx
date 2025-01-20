import { useStorage } from "@plasmohq/storage/hook"

import "~style.css"

export enum LLMProvider {
  GOOGLE = "google",
  OPENAI = "openai",
  AZURE_OPENAI = "azure-openai"
}

function IndexOptions() {
  const [provider, setProvider] = useStorage<LLMProvider>("provider")
  const [model, setModel] = useStorage<string>("model")
  const [apiKey, setApiKey] = useStorage<string>("apiKey")
  const [apiVersion, setApiVersion] = useStorage<string>("apiVersion")
  const [basePath, setBasePath] = useStorage<string>("basePath")

  return (
    <div className="flex flex-col space-y-4 w-[800px] text-lg p-4">
      <div>
        <label
          className="block text-gray-700 text-sm font-bold mb-2"
          htmlFor="provider">
          プロバイダ
        </label>
        <select
          id="provider"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value as LLMProvider)
          }}>
          <option value={LLMProvider.GOOGLE}>{LLMProvider.GOOGLE}</option>
          <option value={LLMProvider.OPENAI}>{LLMProvider.OPENAI}</option>
          <option value={LLMProvider.AZURE_OPENAI}>
            {LLMProvider.AZURE_OPENAI}
          </option>
        </select>
      </div>
      <div>
        <label
          className="block text-gray-700 text-sm font-bold mb-2"
          htmlFor="model">
          モデル
        </label>
        <input
          type="text"
          id="model"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          value={model}
          onChange={(e) => {
            setModel(e.target.value)
          }}
        />
      </div>
      <div>
        <label
          className="block text-gray-700 text-sm font-bold mb-2"
          htmlFor="apiKey">
          APIキー
        </label>
        <input
          type="text"
          id="apiKey"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value)
          }}
        />
      </div>
      {provider == LLMProvider.AZURE_OPENAI ? (
        <>
          <div>
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="apiVersion">
              APIバージョン
            </label>
            <input
              type="text"
              id="apiVersion"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={apiVersion}
              onChange={(e) => {
                setApiVersion(e.target.value)
              }}
            />
          </div>
          <div>
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="basePath">
              ベースパス
            </label>
            <input
              type="text"
              id="basePath"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={basePath}
              onChange={(e) => {
                setBasePath(e.target.value)
              }}
            />
          </div>
        </>
      ) : (
        <></>
      )}
    </div>
  )
}

export default IndexOptions
