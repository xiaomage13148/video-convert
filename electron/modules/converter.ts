import { BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { runFFmpeg, getVideoInfo, type FFmpegProgress } from './ffmpeg-runner'
import { getOutputPath, checkOutputExists } from './scanner'
import { IPC_CHANNELS } from '../ipc/channels'

// 调试日志
function debugLog(msg: string) {
  console.log(`[Converter] ${msg}`)
}

export interface ConvertTask {
  id: string
  inputPath: string
  outputPath: string
  fileName: string
  status: 'waiting' | 'converting' | 'success' | 'failed' | 'cancelled'
  progress: number
  speed: string
  currentTime: string
  codec: string
  duration: number
  error?: string
  process?: ReturnType<typeof import('child_process').spawn> | null
}

interface ConverterOptions {
  concurrency: number
  deleteOriginal: boolean
  outputDir: string
  settings: {
    encoder: string
    preset: string
    quality: number
    maxBitrate: string
    profile: string
    level: string
    audioCopy: boolean
    cudaEnabled: boolean
  }
}

export class Converter {
  private tasks: Map<string, ConvertTask> = new Map()
  private queue: string[] = []
  private activeCount = 0
  private options: ConverterOptions
  private mainWindow: BrowserWindow | null = null
  private isPaused = false
  private logThrottleMap: Map<string, number> = new Map()
  private progressThrottleMap: Map<string, number> = new Map()

  constructor() {
    this.options = {
      concurrency: 3,
      deleteOriginal: true,
      outputDir: '',
      settings: {
        encoder: 'h264_nvenc',
        preset: 'p4',
        quality: 23,
        maxBitrate: '0',
        profile: 'high',
        level: '5.1',
        audioCopy: true,
        cudaEnabled: true,
      },
    }
  }

  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win
  }

  updateOptions(options: Partial<ConverterOptions>) {
    this.options = { ...this.options, ...options }
  }

  private send(channel: string, data: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  private throttledSend(channel: string, taskId: string, data: any, interval: number) {
    const throttleMap = channel === IPC_CHANNELS.CONVERT_PROGRESS ? this.progressThrottleMap : this.logThrottleMap
    const now = Date.now()
    const last = throttleMap.get(taskId) || 0
    if (now - last >= interval) {
      throttleMap.set(taskId, now)
      this.send(channel, data)
    }
  }

  async startConversion(files: string[], options: ConverterOptions) {
    this.updateOptions(options)
    this.tasks.clear()
    this.queue = []
    this.activeCount = 0
    this.isPaused = false

    // 创建任务
    for (const filePath of files) {
      const outputPath = getOutputPath(filePath, this.options.outputDir || undefined)
      const fileName = path.basename(filePath)

      const task: ConvertTask = {
        id: filePath,
        inputPath: filePath,
        outputPath,
        fileName,
        status: 'waiting',
        progress: 0,
        speed: '',
        currentTime: '',
        codec: '',
        duration: 0,
        process: null,
      }

      this.tasks.set(filePath, task)
      this.queue.push(filePath)

      // 发送初始状态
      this.send(IPC_CHANNELS.CONVERT_STATUS, {
        id: task.id,
        fileName: task.fileName,
        status: task.status,
        progress: 0,
        codec: '',
      })
    }

    // 开始处理队列
    this.processQueue()
  }

  private async processQueue() {
    while (this.queue.length > 0 && this.activeCount < this.options.concurrency) {
      if (this.isPaused) break

      const filePath = this.queue.shift()!
      const task = this.tasks.get(filePath)
      if (!task || task.status === 'cancelled') continue

      this.activeCount++
      this.processTask(task).finally(() => {
        this.activeCount--
        this.processQueue()
      })
    }

    // 检查是否全部完成
    if (this.activeCount === 0 && this.queue.length === 0 && this.tasks.size > 0) {
      const results = Array.from(this.tasks.values())
      const successCount = results.filter((t) => t.status === 'success').length
      const failedCount = results.filter((t) => t.status === 'failed').length
      debugLog(`All tasks complete: success=${successCount}, failed=${failedCount}`)

      this.send(IPC_CHANNELS.CONVERT_COMPLETE, {
        success: successCount,
        failed: failedCount,
      })
    }
  }

  private async processTask(task: ConvertTask) {
    try {
      // 检测视频编码和时长
      const info = await getVideoInfo(task.inputPath)
      task.codec = info.codec
      task.duration = info.duration
      debugLog(`Task ${task.fileName}: codec=${info.codec}, duration=${info.duration}`)

      task.status = 'converting'
      debugLog(`Task ${task.fileName}: starting conversion`)
      this.send(IPC_CHANNELS.CONVERT_STATUS, {
        id: task.id,
        fileName: task.fileName,
        status: task.status,
        progress: 0,
        codec: task.codec,
        duration: task.duration,
      })

      // 确保 FFmpeg 使用 spawn 而非 exec
      const { promise, process: proc } = runFFmpeg({
        inputPath: task.inputPath,
        outputPath: task.outputPath,
        codec: task.codec,
        duration: task.duration,
        settings: this.options.settings,
        onProgress: (progress: FFmpegProgress) => {
          task.progress = progress.percent
          task.speed = progress.speed
          task.currentTime = progress.currentTime

          this.throttledSend(IPC_CHANNELS.CONVERT_PROGRESS, task.id, {
            id: task.id,
            percent: progress.percent,
            speed: progress.speed,
            currentTime: progress.currentTime,
            bitrate: progress.bitrate,
          }, 200)
        },
        onLog: (log: string) => {
          this.throttledSend(IPC_CHANNELS.CONVERT_LOG, task.id, {
            taskId: task.id,
            level: log.toLowerCase().includes('error') ? 'error' : 'info',
            message: log,
            timestamp: Date.now(),
          }, 500)
        },
      })

      task.process = proc
      await promise

      // 转换成功
      task.status = 'success'
      task.progress = 100
      debugLog(`Task ${task.fileName}: conversion successful`)

      // 删除原文件
      if (this.options.deleteOriginal) {
        try {
          fs.unlinkSync(task.inputPath)
        } catch {
          // 删除失败不影响转换结果
        }
      }

      // 确保最终进度更新被发送（绕过节流）
      this.send(IPC_CHANNELS.CONVERT_PROGRESS, {
        id: task.id,
        percent: 100,
        speed: '',
        currentTime: '',
        bitrate: '',
      })

      this.send(IPC_CHANNELS.CONVERT_STATUS, {
        id: task.id,
        fileName: task.fileName,
        status: task.status,
        progress: 100,
      })
    } catch (err: any) {
      // 转换失败
      task.status = 'failed'
      task.error = err.message

      // 删除残缺的输出文件
      try {
        if (fs.existsSync(task.outputPath)) {
          fs.unlinkSync(task.outputPath)
        }
      } catch {
        // 清理失败不影响错误报告
      }

      this.send(IPC_CHANNELS.CONVERT_STATUS, {
        id: task.id,
        fileName: task.fileName,
        status: task.status,
        progress: task.progress,
        error: err.message,
      })

      this.send(IPC_CHANNELS.CONVERT_LOG, {
        taskId: task.id,
        level: 'error',
        message: `转换失败: ${err.message}`,
        timestamp: Date.now(),
      })
    }
  }

  pause() {
    this.isPaused = true
  }

  resume() {
    this.isPaused = false
    this.processQueue()
  }

  cancel(taskId?: string) {
    if (taskId) {
      const task = this.tasks.get(taskId)
      if (task) {
        task.status = 'cancelled'
        if (task.process) {
          task.process.kill('SIGKILL')
          task.process = null
        }
        this.send(IPC_CHANNELS.CONVERT_STATUS, {
          id: task.id,
          fileName: task.fileName,
          status: 'cancelled',
          progress: task.progress,
        })
      }
      this.queue = this.queue.filter((id) => id !== taskId)
    } else {
      // 取消全部
      this.isPaused = true
      this.queue = []
      for (const task of this.tasks.values()) {
        if (task.status === 'converting' || task.status === 'waiting') {
          task.status = 'cancelled'
          if (task.process) {
            task.process.kill('SIGKILL')
            task.process = null
          }
          this.send(IPC_CHANNELS.CONVERT_STATUS, {
            id: task.id,
            fileName: task.fileName,
            status: 'cancelled',
            progress: task.progress,
          })
        }
      }
    }
  }

  async retryFailed() {
    const failedTasks = Array.from(this.tasks.values()).filter((t) => t.status === 'failed')
    if (failedTasks.length === 0) return

    for (const task of failedTasks) {
      task.status = 'waiting'
      task.progress = 0
      task.error = undefined
      task.process = null
      this.queue.push(task.id)

      this.send(IPC_CHANNELS.CONVERT_STATUS, {
        id: task.id,
        fileName: task.fileName,
        status: 'waiting',
        progress: 0,
      })
    }

    this.isPaused = false
    this.processQueue()
  }

  getTaskList(): ConvertTask[] {
    return Array.from(this.tasks.values())
  }
}
