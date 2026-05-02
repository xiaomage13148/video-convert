"use strict";
const electron = require("electron");
const IPC_CHANNELS = {
  // 对话框
  DIALOG_SELECT_DIRECTORY: "dialog:selectDirectory",
  // 文件扫描
  SCAN_DIRECTORY: "scan:directory",
  // 转换控制
  CONVERT_START: "convert:start",
  CONVERT_PAUSE: "convert:pause",
  CONVERT_RESUME: "convert:resume",
  CONVERT_CANCEL: "convert:cancel",
  CONVERT_RETRY: "convert:retry",
  // 转换事件（主→渲染）
  CONVERT_PROGRESS: "convert:progress",
  CONVERT_STATUS: "convert:status",
  CONVERT_LOG: "convert:log",
  CONVERT_COMPLETE: "convert:complete",
  // GPU & FFmpeg
  GPU_INFO: "gpu:info",
  FFMPEG_CHECK: "ffmpeg:check",
  // 设置
  SETTINGS_LOAD: "settings:load",
  SETTINGS_SAVE: "settings:save",
  // 最近目录
  RECENT_DIRS: "recent:dirs",
  // 窗口控制
  WINDOW_MINIMIZE: "window:minimize",
  WINDOW_MAXIMIZE: "window:maximize",
  WINDOW_CLOSE: "window:close"
};
const electronAPI = {
  // 对话框
  selectDirectory: () => electron.ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY),
  // 文件扫描
  scanDirectory: (dir) => electron.ipcRenderer.invoke(IPC_CHANNELS.SCAN_DIRECTORY, dir),
  // 转换控制
  startConvert: (files, settings) => electron.ipcRenderer.invoke(IPC_CHANNELS.CONVERT_START, files, settings),
  pauseConvert: () => electron.ipcRenderer.invoke(IPC_CHANNELS.CONVERT_PAUSE),
  resumeConvert: () => electron.ipcRenderer.invoke(IPC_CHANNELS.CONVERT_RESUME),
  cancelConvert: (taskId) => electron.ipcRenderer.invoke(IPC_CHANNELS.CONVERT_CANCEL, taskId),
  retryFailed: () => electron.ipcRenderer.invoke(IPC_CHANNELS.CONVERT_RETRY),
  // GPU & FFmpeg
  getGPUInfo: () => electron.ipcRenderer.invoke(IPC_CHANNELS.GPU_INFO),
  checkFFmpeg: () => electron.ipcRenderer.invoke(IPC_CHANNELS.FFMPEG_CHECK),
  // 设置
  loadSettings: () => electron.ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_LOAD),
  saveSettings: (settings) => electron.ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings),
  // 最近目录
  getRecentDirs: () => electron.ipcRenderer.invoke(IPC_CHANNELS.RECENT_DIRS),
  // 窗口控制
  windowMinimize: () => electron.ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  windowMaximize: () => electron.ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
  windowClose: () => electron.ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  // 事件监听
  onConvertProgress: (callback) => {
    const handler = (_, data) => callback(data);
    electron.ipcRenderer.on(IPC_CHANNELS.CONVERT_PROGRESS, handler);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.CONVERT_PROGRESS, handler);
  },
  onConvertStatus: (callback) => {
    const handler = (_, data) => callback(data);
    electron.ipcRenderer.on(IPC_CHANNELS.CONVERT_STATUS, handler);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.CONVERT_STATUS, handler);
  },
  onConvertLog: (callback) => {
    const handler = (_, data) => callback(data);
    electron.ipcRenderer.on(IPC_CHANNELS.CONVERT_LOG, handler);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.CONVERT_LOG, handler);
  },
  onConvertComplete: (callback) => {
    const handler = (_, data) => callback(data);
    electron.ipcRenderer.on(IPC_CHANNELS.CONVERT_COMPLETE, handler);
    return () => electron.ipcRenderer.removeListener(IPC_CHANNELS.CONVERT_COMPLETE, handler);
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
