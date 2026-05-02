// IPC 通道常量
export const IPC_CHANNELS = {
  // 对话框
  DIALOG_SELECT_DIRECTORY: 'dialog:selectDirectory',

  // 文件扫描
  SCAN_DIRECTORY: 'scan:directory',

  // 转换控制
  CONVERT_START: 'convert:start',
  CONVERT_PAUSE: 'convert:pause',
  CONVERT_RESUME: 'convert:resume',
  CONVERT_CANCEL: 'convert:cancel',
  CONVERT_RETRY: 'convert:retry',

  // 转换事件（主→渲染）
  CONVERT_PROGRESS: 'convert:progress',
  CONVERT_STATUS: 'convert:status',
  CONVERT_LOG: 'convert:log',
  CONVERT_COMPLETE: 'convert:complete',

  // GPU & FFmpeg
  GPU_INFO: 'gpu:info',
  FFMPEG_CHECK: 'ffmpeg:check',

  // 设置
  SETTINGS_LOAD: 'settings:load',
  SETTINGS_SAVE: 'settings:save',

  // 最近目录
  RECENT_DIRS: 'recent:dirs',

  // 窗口控制
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
