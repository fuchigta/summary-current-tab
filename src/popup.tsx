import { useEffect, useState } from "react"

import "~style.css"

import { summarizeCurrentTab } from "~lib/summarize"

function IndexPopup() {
  const [summary, setSummary] = useState("")

  useEffect(() => {
    summarizeCurrentTab()
      .then((res) => setSummary(res))
      .catch(() => {
        chrome.runtime.openOptionsPage()
      })
  }, [])

  return (
    <div className="flex flex-col w-[600px] text-lg text-gray-700 overflow-auto p-4">
      {summary ? (
        <div
          className="markdown"
          dangerouslySetInnerHTML={{ __html: summary }}
        />
      ) : (
        <>Loading...</>
      )}
    </div>
  )
}

export default IndexPopup
