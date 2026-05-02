import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from './ipc/channels'

const electronAPI = {
  // 对话框
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY),

  // 文件扫描
  scanDirectory: (dir: string) => ipcRenderer.invoke(IPC_CHANNELS.SCAN_DIRECTORY, dir),

  // 转换控制
  startConvert: (files: string[], settings: any) => ipcRenderer.invoke(IPC_CHANNELS.CONVERT_START, files, settings),
  pauseConvert: () => ipcRenderer.invoke(IPC_CHANNELS.CONVERT_PAUSE),
  resumeConvert: () => ipcRenderer.invoke(IPC_CHANNELS.CONVERT_RESUME),
  cancelConvert: (taskId?: string) => ipcRenderer.invoke(IPC_CHANNELS.CONVERT_CANCEL, taskId),
  retryFailed: () => ipcRenderer.invoke(IPC_CHANNELS.CONVERT_RETRY),

  // GPU & FFmpeg
  getGPUInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GPU_INFO),
  checkFFmpeg: () => ipcRenderer.invoke(IPC_CHANNELS.FFMPEG_CHECK),

  // 设置
  loadSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_LOAD),
  saveSettings: (settings: any) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings),

  // 最近目录
  getRecentDirs: () => ipcRenderer.invoke(IPC_CHANNELS.RECENT_DIRS),

  // 窗口控制
  windowMinimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  windowMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
  windowClose: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),

  // 事件监听
  onConvertProgress: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.CONVERT_PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CONVERT_PROGRESS, handler)
  },
  onConvertStatus: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.CONVERT_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CONVERT_STATUS, handler)
  },
  onConvertLog: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.CONVERT_LOG, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CONVERT_LOG, handler)
  },
  onConvertComplete: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.CONVERT_COMPLETE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CONVERT_COMPLETE, handler)
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
