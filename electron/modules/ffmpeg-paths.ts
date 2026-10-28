import { app } from 'electron'
import { statSync } from 'fs'
import path from 'path'

export interface FFmpegPaths {
  ffmpeg: string
  ffprobe: string
}

let cachedPaths: FFmpegPaths | undefined

// 检测和执行共用同一组路径，避免状态栏显示可用、转换时却找不到程序。
export function getFFmpegPaths(): FFmpegPaths {
  if (cachedPaths) return cachedPaths

  const bundledDir = app.isPackaged
    ? process.resourcesPath
    : path.join(app.getAppPath(), 'resources')
  const home = process.env.USERPROFILE || process.env.HOME || ''
  const searchDirs = [
    bundledDir,
    ...(process.env.PATH || '').split(path.delimiter).filter(Boolean).map((dir) => dir.replace(/^"|"$/g, '')),
    ...(process.platform === 'win32' ? [
      'C:\\ffmpeg\\bin',
      'C:\\Program Files\\ffmpeg\\bin',
      'C:\\Program Files (x86)\\ffmpeg\\bin',
      'C:\\ProgramData\\chocolatey\\bin',
      'D:\\ffmpeg\\bin',
      ...(home ? [
        path.join(home, 'scoop', 'shims'),
        path.join(home, 'scoop', 'apps', 'ffmpeg', 'current', 'bin'),
        path.join(home, '.local', 'bin'),
      ] : []),
    ] : []),
  ]

  const findBinary = (name: string): string => {
    const filename = process.platform === 'win32' ? `${name}.exe` : name
    for (const dir of searchDirs) {
      const candidate = path.resolve(dir, filename)
      try {
        if (statSync(candidate).isFile()) return candidate
      } catch {
        // 不存在或无法访问时继续查找。
      }
    }
    return name
  }

  cachedPaths = { ffmpeg: findBinary('ffmpeg'), ffprobe: findBinary('ffprobe') }
  return cachedPaths
}
