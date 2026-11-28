import { afterEach, describe, expect, it, vi } from "vitest"

import "~background"

// background.ts は読み込まれた時点で chrome のイベントにリスナーを登録する。
// vi.hoisted の中身は vitest がどの import よりも先に実行するので、そこで chrome をモックし、
// 登録されたリスナーを直接呼び出して確かめる。
const listeners = vi.hoisted(() => {
  const listeners = {
    onInstalled: undefined as () => void,
    onClicked: undefined as (info: { menuItemId: string }) => Promise<void>,
    createMenu: vi.fn(),
    openPopup: vi.fn()
  }
  vi.stubGlobal("chrome", {
    runtime: {
      onInstalled: {
        addListener: (listener: () => void) => {
          listeners.onInstalled = listener
        }
      }
    },
    contextMenus: {
      create: listeners.createMenu,
      onClicked: {
        addListener: (listener: typeof listeners.onClicked) => {
          listeners.onClicked = listener
        }
      }
    },
    action: { openPopup: listeners.openPopup }
  })
  return listeners
})

const { createMenu, openPopup } = listeners

afterEach(() => {
  vi.clearAllMocks()
})

describe("background", () => {
  it("インストール時に、どこでも出る「Webページを要約」メニューを登録する", () => {
    expect(createMenu).not.toHaveBeenCalled()

    listeners.onInstalled()

    expect(createMenu).toHaveBeenCalledTimes(1)
    expect(createMenu).toHaveBeenCalledWith({
      id: "summary",
      title: "Webページを要約",
      contexts: ["all"]
    })
  })

  it("要約メニューがクリックされたらポップアップを開く", async () => {
    await listeners.onClicked({ menuItemId: "summary" })

    expect(openPopup).toHaveBeenCalledTimes(1)
  })

  it("ほかのメニューがクリックされてもポップアップは開かない", async () => {
    await listeners.onClicked({ menuItemId: "other" })

    expect(openPopup).not.toHaveBeenCalled()
  })
})
