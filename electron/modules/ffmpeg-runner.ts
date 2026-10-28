import { spawn, execFile, type ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getFFmpegPaths } from './ffmpeg-paths'

export interface FFmpegProgress {
  percent: number
  speed: string
  currentTime: string
  bitrate: string
  frame: number
  fps: number
}

export interface FFmpegOptions {
  inputPath: string
  outputPath: string
  codec: string
  audioCodec: string
  duration: number
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
  onProgress?: (progress: FFmpegProgress) => void
  onLog?: (log: string) => void
  /**
   * 每次实际启动 FFmpeg 进程时回调（含 CUDA 回退后的 CPU 进程）。
   * 调用方通过该回调持有当前进程引用，用于取消；
   * 不能通过返回值传递进程，否则回退启动新进程后调用方引用会失效。
   */
  onProcess?: (proc: ChildProcess) => void
}

// 检测视频编码
export function detectVideoCodec(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    const args = ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'default=noprint_wrappers=1:nokey=1', filePath]
    execFile(getFFmpegPaths().ffprobe, args, { maxBuffer: 1024 * 1024, windowsHide: true }, (error, stdout) => {
      if (error) {
        resolve('unknown')
      } else {
        resolve(stdout.trim() || 'unknown')
      }
    })
  })
}

// 获取视频时长（秒）
export function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    // 先尝试标准方式
    const args = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath]
    execFile(getFFmpegPaths().ffprobe, args, { maxBuffer: 1024 * 1024, windowsHide: true }, (error, stdout) => {
      if (!error && stdout.trim()) {
        const duration = parseFloat(stdout.trim())
        if (!isNaN(duration) && duration > 0) {
          resolve(duration)
          return
        }
      }
      // 对于 .ts 等格式，尝试从流信息中获取
      const fallbackArgs = ['-v', 'error', '-show_entries', 'stream=duration', '-of', 'default=noprint_wrappers=1:nokey=1', '-select_streams', 'v:0', filePath]
      execFile(getFFmpegPaths().ffprobe, fallbackArgs, { maxBuffer: 1024 * 1024, windowsHide: true }, (error2, stdout2) => {
        if (!error2 && stdout2.trim()) {
          const duration = parseFloat(stdout2.trim())
          if (!isNaN(duration) && duration > 0) {
            resolve(duration)
            return
          }
        }
        resolve(0)
      })
    })
  })
}

// 检测音频编码
export function detectAudioCodec(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    const args = ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name', '-of', 'default=noprint_wrappers=1:nokey=1', filePath]
    execFile(getFFmpegPaths().ffprobe, args, { maxBuffer: 1024 * 1024, windowsHide: true }, (error, stdout) => {
      if (error) {
        resolve('unknown')
      } else {
        resolve(stdout.trim() || 'unknown')
      }
    })
  })
}

// 获取视频信息
export async function getVideoInfo(filePath: string) {
  const [codec, duration, audioCodec] = await Promise.all([
    detectVideoCodec(filePath),
    getVideoDuration(filePath),
    detectAudioCodec(filePath),
  ])
  return { codec, duration, audioCodec }
}

// 构建 FFmpeg 参数
export function buildFFmpegArgs(options: FFmpegOptions): string[] {
  const { inputPath, outputPath, codec, settings } = options
  const args: string[] = []

  // TS 容错：忽略解码错误，避免遇到损坏帧直接退出
  args.push('-err_detect', 'ignore_err')
  // 忽略异常 DTS 时间戳（不使用 +genpts，避免不必要的性能开销）
  args.push('-fflags', '+igndts')

  // 硬件加速
  if (settings.cudaEnabled) {
    args.push('-hwaccel', 'cuda')

    // 根据输入编码选择解码器
    const decoderMap: Record<string, string> = {
      h264: 'h264_cuvid',
      hevc: 'hevc_cuvid',
      h265: 'hevc_cuvid',
      mpeg2video: 'mpeg2_cuvid',
      mpeg4: 'mpeg4_cuvid',
      vp9: 'vp9_cuvid',
    }
    const decoder = decoderMap[codec]
    if (decoder) {
      args.push('-c:v', decoder)
    }
  }

  // TS 文件可能被 FFmpeg 误识别为 PNG，强制指定输入格式
  const ext = path.extname(inputPath).toLowerCase()
  if (ext === '.ts' || ext === '.mts' || ext === '.m2ts') {
    args.push('-f', 'mpegts')
  }

  // 输入文件
  args.push('-i', inputPath)

  // 显式只选择视频和音频流，跳过其他流（如位图字幕/数据流），避免 PNG 解码器报错
  args.push('-map', '0:v', '-map', '0:a?')

  // 视频编码器
  args.push('-c:v', settings.encoder)

  // 编码器特定参数
  if (settings.encoder.includes('nvenc')) {
    args.push('-preset', settings.preset)
    args.push('-tune', 'hq')
    args.push('-rc', 'vbr')
    args.push('-cq', String(settings.quality))
    args.push('-b:v', settings.maxBitrate || '0')
    args.push('-bufsize', '16M')
    args.push('-profile:v', settings.profile)
    args.push('-level', settings.level)
  } else {
    // CPU 编码器 (libx264/libx265)
    args.push('-preset', settings.preset)
    args.push('-crf', String(settings.quality))
    if (settings.profile) {
      args.push('-profile:v', settings.profile)
    }
  }

  args.push('-pix_fmt', 'yuv420p')
  args.push('-movflags', '+faststart')

  // 音频
  // Opus 等格式在部分播放器中不支持，即使用户选择复制也需转码
  const needAudioTranscode = options.audioCodec === 'opus' || options.audioCodec === 'vorbis' || options.audioCodec === 'flac'
  if (settings.audioCopy && !needAudioTranscode) {
    args.push('-c:a', 'copy')
  } else {
    args.push('-c:a', 'aac', '-b:a', '192k')
  }

  // 跳过字幕流，避免位图字幕（DVB subtitles）触发 PNG 解码器报错导致 FFmpeg 退出
  args.push('-sn')

  // 防止 muxing 队列溢出导致退出（输出选项，必须在输出文件之前）
  args.push('-max_muxing_queue_size', '4096')

  // 输出文件
  args.push('-y', outputPath)

  return args
}

// 从 FFmpeg stderr 中提取视频时长
function extractDurationFromStderr(stderr: string): number {
  const durMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
  if (durMatch) {
    const h = parseFloat(durMatch[1])
    const m = parseFloat(durMatch[2])
    const s = parseFloat(durMatch[3])
    return h * 3600 + m * 60 + s
  }
  return 0
}

// 解析 FFmpeg 进度
function parseProgress(stderr: string, duration: number): FFmpegProgress | null {
  const timeMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
  if (!timeMatch) return null

  const hours = parseFloat(timeMatch[1])
  const minutes = parseFloat(timeMatch[2])
  const seconds = parseFloat(timeMatch[3])
  const currentTime = hours * 3600 + minutes * 60 + seconds

  const speedMatch = stderr.match(/speed=\s*([\d.]+)\w+/)
  const bitrateMatch = stderr.match(/bitrate=\s*([\d.]+\w+\/s)/)
  const frameMatch = stderr.match(/frame=\s*(\d+)/)
  const fpsMatch = stderr.match(/fps=\s*([\d.]+)/)

  const effectiveDuration = duration > 0 ? duration : extractDurationFromStderr(stderr)
  const percent = effectiveDuration > 0 ? Math.min((currentTime / effectiveDuration) * 100, 99.9) : 0

  return {
    percent: Math.round(percent * 10) / 10,
    speed: speedMatch ? speedMatch[1] : '0',
    currentTime: `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`,
    bitrate: bitrateMatch ? bitrateMatch[1] : '0kbits/s',
    frame: frameMatch ? parseInt(frameMatch[1]) : 0,
    fps: fpsMatch ? parseFloat(fpsMatch[1]) : 0,
  }
}

// 启动单次 FFmpeg 进程
function spawnFFmpegProcess(
  args: string[],
  options: FFmpegOptions,
): {
  promise: Promise<void>
  process: ChildProcess
} {
  const proc = spawn(getFFmpegPaths().ffmpeg, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })

  let stderrBuffer = ''
  let firstProgressLogged = false

  proc.stderr.on('data', (data: Buffer) => {
    const text = data.toString()
    stderrBuffer += text
    const lines = stderrBuffer.split('\r')
    const lastLine = lines[lines.length - 1]

    if (options.onProgress) {
      const progress = parseProgress(lastLine, options.duration)
      if (progress) {
        if (!firstProgressLogged) {
          firstProgressLogged = true
          console.log(`[FFmpeg] First progress: percent=${progress.percent}%, duration=${options.duration}, currentTime=${progress.currentTime}, speed=${progress.speed}`)
        }
        options.onProgress(progress)
      }
    }

    if (options.onLog) {
      if (text.includes('frame=') || text.includes('error') || text.includes('Error')) {
        options.onLog(text.trim())
      }
    }

    if (stderrBuffer.length > 10000) {
      stderrBuffer = stderrBuffer.slice(-5000)
    }
  })

  const promise = new Promise<void>((resolve, reject) => {
    proc.on('close', (code) => {
      // 进程结束后立即释放事件监听，允许 GC 回收关联的 Buffer
      proc.stderr.removeAllListeners()
      proc.removeAllListeners()
      stderrBuffer = ''
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })
    proc.on('error', (err) => {
      proc.stderr.removeAllListeners()
      proc.removeAllListeners()
      stderrBuffer = ''
      reject(new Error(`FFmpeg process error: ${err.message}`))
    })
  })

  return { promise, process: proc }
}

// 运行 FFmpeg 转换，CUDA 失败时自动回退 CPU
export function runFFmpeg(options: FFmpegOptions): {
  promise: Promise<void>
} {
  const args = buildFFmpegArgs(options)
  const useCuda = options.settings.cudaEnabled

  // 清理上一次残留的输出文件，避免回退时 -y 报错
  try {
    if (fs.existsSync(options.outputPath)) {
      fs.unlinkSync(options.outputPath)
    }
  } catch {
    // 忽略清理失败
  }

  const { promise: firstPromise, process: firstProc } = spawnFFmpegProcess(args, options)
  // 通过回调把进程引用交给调用方（用于取消），而非通过返回值
  options.onProcess?.(firstProc)

  const finalPromise = firstPromise.catch((err) => {
    // CUDA 解码失败时回退到 CPU
    if (useCuda) {
      console.log(`[FFmpeg] CUDA decoding failed (${err.message}), falling back to CPU...`)
      if (options.onLog) {
        options.onLog('CUDA 解码失败，自动回退到 CPU 解码...')
      }

      const cpuOptions = { ...options, settings: { ...options.settings, cudaEnabled: false } }
      const cpuArgs = buildFFmpegArgs(cpuOptions)

      // 清理 CUDA 失败产生的残缺文件
      try {
        if (fs.existsSync(options.outputPath)) {
          fs.unlinkSync(options.outputPath)
        }
      } catch {
        // 忽略
      }

      const { promise: cpuPromise, process: cpuProc } = spawnFFmpegProcess(cpuArgs, options)
      // 回退进程同样通过回调同步给调用方，确保取消功能仍然有效
      options.onProcess?.(cpuProc)

      return cpuPromise
    }
    throw err
  })

  return { promise: finalPromise }
}
