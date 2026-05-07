import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { IPC_CHANNELS } from './ipc/channels'
import { scanDirectory } from './modules/scanner'
import { Converter } from './modules/converter'
import { detectGPU, checkFFmpeg } from './modules/gpu-detector'
import { loadSettings, saveSettings, addRecentDir, getRecentDirs } from './modules/settings-store'

// 调试日志
const LOG_FILE = path.join(app.getPath('temp'), 'video-convert-debug.log')
function debugLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { fs.appendFileSync(LOG_FILE, line) } catch {}
  console.log(line.trim())
}
debugLog(`App starting, log file: ${LOG_FILE}`)

let mainWindow: BrowserWindow | null = null
const converter = new Converter()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    backgroundColor: '#0F0F1A',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  converter.setMainWindow(mainWindow)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 注册 IPC 处理器
function registerIpcHandlers() {
  // 窗口控制
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => mainWindow?.minimize())
  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => mainWindow?.close())

  // 目录选择对话框
  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY, async () => {
    try {
      debugLog('DIALOG_SELECT_DIRECTORY called')
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ['openDirectory'],
        title: '选择视频目录',
      })
      if (result.canceled || result.filePaths.length === 0) {
        debugLog('Dialog canceled')
        return null
      }
      const dir = result.filePaths[0]
      debugLog(`Selected dir: ${dir}`)
      addRecentDir(dir)
      return dir
    } catch (e: any) {
      debugLog(`DIALOG_SELECT_DIRECTORY error: ${e?.message || e}`)
      throw new Error(`选择目录失败: ${e?.message || e}`)
    }
  })

  // 文件扫描
  ipcMain.handle(IPC_CHANNELS.SCAN_DIRECTORY, async (_, dir: string) => {
    try {
      debugLog(`SCAN_DIRECTORY called with: ${dir}`)
      addRecentDir(dir)
      const result = scanDirectory(dir)
      debugLog(`Scan result: ${JSON.stringify(result).substring(0, 500)}`)
      return result
    } catch (e: any) {
      debugLog(`SCAN_DIRECTORY error: ${e?.message || e}`)
      throw new Error(`扫描目录失败: ${e?.message || e}`)
    }
  })

  // 转换控制
  ipcMain.handle(IPC_CHANNELS.CONVERT_START, (_, files: string[], settings: any) => {
    return converter.startConversion(files, settings)
  })
  ipcMain.handle(IPC_CHANNELS.CONVERT_PAUSE, () => converter.pause())
  ipcMain.handle(IPC_CHANNELS.CONVERT_RESUME, () => converter.resume())
  ipcMain.handle(IPC_CHANNELS.CONVERT_CANCEL, (_, taskId?: string) => converter.cancel(taskId))
  ipcMain.handle(IPC_CHANNELS.CONVERT_RETRY, () => converter.retryFailed())

  // GPU & FFmpeg 检测
  ipcMain.handle(IPC_CHANNELS.GPU_INFO, async () => {
    try {
      debugLog('GPU_INFO called')
      const result = await detectGPU()
      debugLog(`GPU result: available=${result.available}`)
      return result
    } catch (e: any) {
      debugLog(`GPU_INFO error: ${e?.message || e}`)
      return { available: false, name: '', driverVersion: '', cudaVersion: '', memoryTotal: '' }
    }
  })
  ipcMain.handle(IPC_CHANNELS.FFMPEG_CHECK, async () => {
    try {
      debugLog('FFMPEG_CHECK called')
      debugLog(`PATH: ${process.env.PATH}`)
      const result = await checkFFmpeg()
      debugLog(`FFmpeg result: available=${result.available}, path=${result.path}`)
      return result
    } catch (e: any) {
      debugLog(`FFMPEG_CHECK error: ${e?.message || e}`)
      return { available: false, path: '' }
    }
  })

  // 设置
  ipcMain.handle(IPC_CHANNELS.SETTINGS_LOAD, () => loadSettings())
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, (_, settings: any) => saveSettings(settings))
  ipcMain.handle(IPC_CHANNELS.RECENT_DIRS, () => getRecentDirs())
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
