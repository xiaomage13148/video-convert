import { ref, onUnmounted } from 'vue'
import type { ProgressData, StatusData, LogEntry, CompleteStats, GPUInfo, ConvertSettings, VideoFile } from '../types'

const api = window.electronAPI

export function useElectron() {
  const unsubs: (() => void)[] = []

  function cleanup() {
    unsubs.forEach((fn) => fn())
    unsubs.length = 0
  }

  onUnmounted(cleanup)

  return {
    // 对话框
    selectDirectory: () => api.selectDirectory(),

    // 文件扫描
    scanDirectory: (dir: string) => api.scanDirectory(dir) as Promise<VideoFile[]>,

    // 转换控制
    startConvert: (files: string[], settings: ConvertSettings) =>
      api.startConvert(files, settings),
    pauseConvert: () => api.pauseConvert(),
    resumeConvert: () => api.resumeConvert(),
    cancelConvert: (taskId?: string) => api.cancelConvert(taskId),
    retryFailed: () => api.retryFailed(),

    // GPU & FFmpeg
    getGPUInfo: () => api.getGPUInfo() as Promise<GPUInfo>,
    checkFFmpeg: () => api.checkFFmpeg() as Promise<{ available: boolean; path: string }>,

    // 设置
    loadSettings: () => api.loadSettings() as Promise<ConvertSettings>,
    saveSettings: (settings: ConvertSettings) => api.saveSettings(settings),

    // 最近目录
    getRecentDirs: () => api.getRecentDirs() as Promise<string[]>,

    // 窗口控制
    windowMinimize: () => api.windowMinimize(),
    windowMaximize: () => api.windowMaximize(),
    windowClose: () => api.windowClose(),

    // 事件监听
    onConvertProgress: (cb: (data: ProgressData) => void) => {
      const unsub = api.onConvertProgress(cb)
      unsubs.push(unsub)
      return unsub
    },
    onConvertStatus: (cb: (data: StatusData) => void) => {
      const unsub = api.onConvertStatus(cb)
      unsubs.push(unsub)
      return unsub
    },
    onConvertLog: (cb: (data: LogEntry) => void) => {
      const unsub = api.onConvertLog(cb)
      unsubs.push(unsub)
      return unsub
    },
    onConvertComplete: (cb: (data: CompleteStats) => void) => {
      const unsub = api.onConvertComplete(cb)
      unsubs.push(unsub)
      return unsub
    },
  }
}
