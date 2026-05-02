import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface AppSettings {
  encoder: string
  preset: string
  quality: number
  maxBitrate: string
  profile: string
  level: string
  audioCopy: boolean
  cudaEnabled: boolean
  deleteOriginal: boolean
  concurrency: number
  outputDir: string
  recentDirs: string[]
}

const DEFAULT_SETTINGS: AppSettings = {
  encoder: 'h264_nvenc',
  preset: 'p4',
  quality: 23,
  maxBitrate: '0',
  profile: 'high',
  level: '5.1',
  audioCopy: true,
  cudaEnabled: true,
  deleteOriginal: true,
  concurrency: 3,
  outputDir: '',
  recentDirs: [],
}

function getSettingsPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'settings.json')
}

export function loadSettings(): AppSettings {
  try {
    const settingsPath = getSettingsPath()
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8')
      const saved = JSON.parse(data)
      return { ...DEFAULT_SETTINGS, ...saved }
    }
  } catch {
    // 返回默认设置
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  try {
    const current = loadSettings()
    const updated = { ...current, ...settings }
    const settingsPath = getSettingsPath()
    const dir = path.dirname(settingsPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), 'utf-8')
    return updated
  } catch {
    return loadSettings()
  }
}

export function addRecentDir(dir: string): string[] {
  const settings = loadSettings()
  let recentDirs = settings.recentDirs.filter((d) => d !== dir)
  recentDirs.unshift(dir)
  recentDirs = recentDirs.slice(0, 5)
  saveSettings({ recentDirs })
  return recentDirs
}

export function getRecentDirs(): string[] {
  return loadSettings().recentDirs
}
