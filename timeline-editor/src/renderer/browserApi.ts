import actionsData from '../../data/actions.json'

const textFiles = new Map<string, string>()
let lastOpenedFileName: string | null = null

function noopUnsubscribe() {
  return () => {}
}

function pickFile(): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.txt,application/json,text/plain'
    input.style.display = 'none'
    input.onchange = async () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) {
        resolve(null)
        return
      }
      lastOpenedFileName = file.name
      resolve({ name: file.name, content: await file.text() })
    }
    input.oncancel = () => {
      input.remove()
      resolve(null)
    }
    document.body.appendChild(input)
    input.click()
  })
}

function downloadText(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || 'NewTriggerline.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const browserAPI: ElectronAPI = {
  async readFile(filePath: string) {
    const cached = textFiles.get(filePath)
    if (cached !== undefined) return { success: true, content: cached }
    return { success: false, error: 'File is not available in browser memory. Please open it again.' }
  },

  async writeFile(filePath: string, content: string) {
    textFiles.set(filePath, content)
    downloadText(filePath.split(/[/\\]/).pop() || filePath, content)
    return { success: true }
  },

  async fileExists(filePath: string) {
    return textFiles.has(filePath)
  },

  async fileStat(filePath: string) {
    const content = textFiles.get(filePath)
    if (content === undefined) return { success: false, error: 'Browser page cannot inspect local filesystem paths.' }
    return { success: true, size: new Blob([content]).size, mtime: Date.now(), isDirectory: false }
  },

  async listDir() {
    return { success: true, entries: [] }
  },

  async openFileDialog() {
    const picked = await pickFile()
    if (!picked) return { cancelled: true, filePath: null }
    textFiles.set(picked.name, picked.content)
    return { cancelled: false, filePath: picked.name }
  },

  async saveFileDialog(defaultName = lastOpenedFileName || 'NewTriggerline.json') {
    return { cancelled: false, filePath: defaultName }
  },

  async getDefaultDir() {
    return '浏览器模式：请使用上方 Open 按钮打开单个文件'
  },

  async getBackupDir(filePath: string) {
    return filePath
  },

  async loadSpellData() {
    return { success: true, data: actionsData as Record<string, { n: string; t: number }> }
  },

  async getAeDirectory() {
    return ''
  },

  async selectAeDirectory() {
    alert('浏览器版无法直接访问本地 AE 目录。请使用 Open 打开触发器文件，Save/Save As 会下载编辑后的文件。')
    return { cancelled: true }
  },

  async getAcrDir() { return '' },
  onAeDirectoryChanged(_callback: (newDir: string) => void) { return noopUnsubscribe() },
  async discoverAcrTypes() { return { success: true, conditions: [], actions: [], acrDlls: [] } },
  async listAcrDlls() { return { success: true, dlls: [] } },
  onAcrTypesChanged(_callback: () => void) { return noopUnsubscribe() },
  async getVersion() { return 'browser' },
  async checkForUpdates() {
    return { hasUpdate: false, currentVersion: 'browser', latestVersion: null, zipUrl: null, releaseNotes: '浏览器版不支持应用内更新。' }
  },
  async downloadUpdate() { return { success: false, error: '浏览器版不支持应用内更新。' } },
  async installUpdate() { return { success: false, error: '浏览器版不支持应用内更新。' } },
  onUpdateProgress(_callback: (progress: { percent: number; downloaded: number; total: number; speed: string }) => void) { return noopUnsubscribe() },
  onUpdateAvailable(_callback: (info: { latestVersion: string; releaseNotes?: string }) => void) { return noopUnsubscribe() },
}

if (!window.electronAPI) {
  window.electronAPI = browserAPI
}
