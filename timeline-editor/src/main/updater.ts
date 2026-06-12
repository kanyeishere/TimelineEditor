import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, readFileSync, createWriteStream, unlinkSync, mkdirSync } from 'fs'
import { rm, mkdir, readFile } from 'fs/promises'
import { get } from 'https'
import { spawn } from 'child_process'
import { tmpdir } from 'os'
import AdmZip from 'adm-zip'

// --- Version ---

function getCurrentVersion(): string {
  try {
    // In packaged mode, package.json is at the app root (alongside the exe)
    const pkgPath = join(app.getAppPath(), 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export const getVersion = getCurrentVersion

// --- GitHub API ---

const GITHUB_API = 'https://api.github.com/repos/ShoOtaku/TimelineEditor/releases/latest'

interface ReleaseInfo {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string | null
  zipUrl: string | null
  releaseNotes: string | null
  error?: string
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    get(url, { headers }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJson(res.headers.location, headers).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      let body = ''
      res.on('data', (chunk: Buffer) => { body += chunk.toString() })
      res.on('end', () => {
        try { resolve(JSON.parse(body)) }
        catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

function compareVersions(a: string, b: string): number {
  // Returns positive if a > b, negative if a < b, 0 if equal
  const ap = a.replace(/^v/, '').split('.').map(Number)
  const bp = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const av = ap[i] || 0
    const bv = bp[i] || 0
    if (av !== bv) return av - bv
  }
  return 0
}

export async function checkForUpdates(): Promise<ReleaseInfo> {
  const currentVersion = getCurrentVersion()

  try {
    const release = await fetchJson(GITHUB_API, {
      'User-Agent': 'TimelineEditor-Updater',
      'Accept': 'application/vnd.github.v3+json'
    })

    const tagName: string = release.tag_name || ''
    const latestVersion = tagName.replace(/^v/, '')

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion,
        zipUrl: null,
        releaseNotes: null
      }
    }

    // Find the portable zip asset
    const assets: Array<{ name: string; browser_download_url: string }> = release.assets || []
    const zipAsset = assets.find((a: { name: string }) =>
      a.name.endsWith('-portable.zip') || a.name.endsWith('.zip')
    )

    return {
      hasUpdate: true,
      currentVersion,
      latestVersion,
      zipUrl: zipAsset?.browser_download_url || null,
      releaseNotes: release.body || null
    }
  } catch (err) {
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: null,
      zipUrl: null,
      releaseNotes: null,
      error: String(err)
    }
  }
}

// --- Download ---

interface DownloadProgress {
  percent: number
  downloaded: number
  total: number
  speed: string
}

export async function downloadUpdate(
  zipUrl: string,
  onProgress: (progress: DownloadProgress) => void
): Promise<string> {
  const tmpDir = join(tmpdir(), 'timeline-editor-update')
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true })
  }
  const zipPath = join(tmpDir, 'update.zip')

  return new Promise((resolve, reject) => {
    get(zipUrl, {
      headers: { 'User-Agent': 'TimelineEditor-Updater' }
    }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const file = createWriteStream(zipPath)
        get(res.headers.location, {
          headers: { 'User-Agent': 'TimelineEditor-Updater' }
        }, (redirectRes) => {
          pipeDownload(redirectRes, file, zipPath, onProgress, resolve, reject)
        }).on('error', reject)
        return
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }

      const file = createWriteStream(zipPath)
      pipeDownload(res, file, zipPath, onProgress, resolve, reject)
    }).on('error', reject)
  })
}

function pipeDownload(
  res: any,
  file: ReturnType<typeof createWriteStream>,
  zipPath: string,
  onProgress: (progress: DownloadProgress) => void,
  resolve: (path: string) => void,
  reject: (err: Error) => void
) {
  const total = parseInt(res.headers['content-length'] || '0', 10)
  let downloaded = 0
  let lastTime = Date.now()
  let lastBytes = 0

  res.on('data', (chunk: Buffer) => {
    downloaded += chunk.length
    const now = Date.now()
    const elapsed = (now - lastTime) / 1000
    let speed = ''
    if (elapsed >= 0.5) {
      const bytesPerSec = (downloaded - lastBytes) / elapsed
      speed = formatSpeed(bytesPerSec)
      lastTime = now
      lastBytes = downloaded
    }
    const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0
    onProgress({ percent, downloaded, total, speed })
  })

  file.on('finish', () => {
    file.close()
    resolve(zipPath)
  })

  res.on('error', (err: Error) => {
    try { unlinkSync(zipPath) } catch { /* ignore */ }
    reject(err)
  })

  file.on('error', (err: Error) => {
    try { unlinkSync(zipPath) } catch { /* ignore */ }
    reject(err)
  })

  res.pipe(file)
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
}

// --- Install ---

export async function installUpdate(zipPath: string): Promise<void> {
  const tmpDir = join(tmpdir(), 'timeline-editor-update')
  const stagingDir = join(tmpDir, 'staging')

  // Clean staging dir
  if (existsSync(stagingDir)) {
    await rm(stagingDir, { recursive: true, force: true })
  }
  await mkdir(stagingDir, { recursive: true })

  // Extract zip
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(stagingDir, true)

  // Find the executable in staging
  const { readdir } = await import('fs/promises')
  const stagingFiles = await readdir(stagingDir)
  const exeName = stagingFiles.find(f => f.endsWith('.exe')) || 'Timeline Editor.exe'

  // The app directory is where the current exe lives
  const appDir = process.resourcesPath
  // For dir target builds, process.execPath is <appDir>/<exeName>
  // process.resourcesPath is the resources dir within the asar/app
  // We need path.dirname(process.execPath) for the actual app directory
  const targetDir = join(dirname(process.execPath))

  // Write the bootstrap PowerShell script
  const scriptPath = join(tmpDir, 'install-update.ps1')
  const scriptContent = `# Timeline Editor Update Installer
$ErrorActionPreference = 'Stop'

# Wait for old process to fully exit
Start-Sleep -Seconds 2

try {
    Write-Host "Copying new files..."
    Get-ChildItem -Path "${stagingDir}" -Recurse | ForEach-Object {
        $relative = $_.FullName.Substring(${stagingDir.length})
        $target = Join-Path "${targetDir}" $relative
        $targetDir2 = Split-Path $target -Parent
        if (-not (Test-Path $targetDir2)) {
            New-Item -ItemType Directory -Path $targetDir2 -Force | Out-Null
        }
        if (-not $_.PSIsContainer) {
            Copy-Item $_.FullName $target -Force
        }
    }

    Write-Host "Update complete. Starting new version..."
    Start-Process -FilePath (Join-Path "${targetDir}" "${exeName}")
}
catch {
    Write-Host "Update failed: $_"
    Read-Host "Press Enter to exit"
    exit 1
}
finally {
    # Cleanup temp files
    Remove-Item -Path "${tmpDir}" -Recurse -Force -ErrorAction SilentlyContinue
}
`

  const { writeFile } = await import('fs/promises')
  await writeFile(scriptPath, scriptContent, 'utf-8')

  // Spawn the PowerShell script detached
  spawn('powershell.exe', [
    '-ExecutionPolicy', 'Bypass',
    '-NoProfile',
    '-WindowStyle', 'Hidden',
    '-File', scriptPath
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  }).unref()

  // Quit the app
  app.quit()
}
