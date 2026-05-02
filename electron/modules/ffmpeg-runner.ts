import { spawn, exec } from 'child_process'
import path from 'path'

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
}

// 检测视频编码
export function detectVideoCodec(filePath: string): Promise<string> {
  return new Promise((resolve) => {
    const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    exec(cmd, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
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
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    exec(cmd, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (!error && stdout.trim()) {
        const duration = parseFloat(stdout.trim())
        if (!isNaN(duration) && duration > 0) {
          resolve(duration)
          return
        }
      }
      // 对于 .ts 等格式，尝试从流信息中获取
      const cmd2 = `ffprobe -v error -show_entries stream=duration -of default=noprint_wrappers=1:nokey=1 -select_streams v:0 "${filePath}"`
      exec(cmd2, { maxBuffer: 1024 * 1024 }, (error2, stdout2) => {
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

// 获取视频信息
export async function getVideoInfo(filePath: string) {
  const [codec, duration] = await Promise.all([
    detectVideoCodec(filePath),
    getVideoDuration(filePath),
  ])
  return { codec, duration }
}

// 构建 FFmpeg 参数
export function buildFFmpegArgs(options: FFmpegOptions): string[] {
  const { inputPath, outputPath, codec, settings } = options
  const args: string[] = []

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

  // 输入文件
  args.push('-i', inputPath)

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
  if (settings.audioCopy) {
    args.push('-c:a', 'copy')
  } else {
    args.push('-c:a', 'aac', '-b:a', '192k')
  }

  // 字幕
  args.push('-c:s', 'copy')

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

// 运行 FFmpeg 转换
export function runFFmpeg(options: FFmpegOptions): {
  promise: Promise<void>
  process: ReturnType<typeof spawn>
} {
  const args = buildFFmpegArgs(options)

  const proc = spawn('ffmpeg', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let stderrBuffer = ''
  let firstProgressLogged = false

  proc.stderr.on('data', (data: Buffer) => {
    stderrBuffer += data.toString()
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
      // 只输出关键信息行
      const text = data.toString()
      if (text.includes('frame=') || text.includes('error') || text.includes('Error')) {
        options.onLog(text.trim())
      }
    }

    // 保持缓冲区不要太大
    if (stderrBuffer.length > 10000) {
      stderrBuffer = stderrBuffer.slice(-5000)
    }
  })

  const promise = new Promise<void>((resolve, reject) => {
    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })
    proc.on('error', (err) => {
      reject(new Error(`FFmpeg process error: ${err.message}`))
    })
  })

  return { promise, process: proc }
}
