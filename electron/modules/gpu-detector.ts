import { exec, execFile } from 'child_process'
import { getFFmpegPaths } from './ffmpeg-paths'

export interface GPUInfo {
  available: boolean
  name: string
  driverVersion: string
  cudaVersion: string
  memoryTotal: string
}

export async function detectGPU(): Promise<GPUInfo> {
  return new Promise((resolve) => {
    exec('nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader,nounits', {
      maxBuffer: 1024 * 1024,
    }, (error, stdout) => {
      if (error) {
        resolve({
          available: false,
          name: '',
          driverVersion: '',
          cudaVersion: '',
          memoryTotal: '',
        })
        return
      }

      const lines = stdout.trim().split('\n')
      if (lines.length === 0) {
        resolve({
          available: false,
          name: '',
          driverVersion: '',
          cudaVersion: '',
          memoryTotal: '',
        })
        return
      }

      const parts = lines[0].split(',').map((s) => s.trim())
      const name = parts[0] || 'Unknown'
      const driverVersion = parts[1] || 'Unknown'
      const memoryTotal = parts[2] ? `${parts[2]} MB` : 'Unknown'

      // 获取 CUDA 版本
      exec('nvidia-smi --query-gpu=compute_cap --format=csv,noheader,nounits', {
        maxBuffer: 1024 * 1024,
      }, (_, cudaStdout) => {
        const cudaVersion = cudaStdout ? cudaStdout.trim() : 'Unknown'

        resolve({
          available: true,
          name,
          driverVersion,
          cudaVersion,
          memoryTotal,
        })
      })
    })
  })
}

export async function checkFFmpeg(): Promise<{ available: boolean; path: string }> {
  const paths = getFFmpegPaths()
  const runCheck = (binary: string, name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      execFile(binary, ['-version'], { maxBuffer: 1024 * 1024, timeout: 10000, windowsHide: true }, (error, stdout, stderr) => {
        const output = stdout + '\n' + stderr
        const match = output.match(new RegExp(`${name} version\\s+(\\S+)`))
        resolve(!error && match ? match[1] : null)
      })
    })
  }

  // 视频信息读取也依赖 ffprobe，两个程序都能启动才算就绪。
  const [ffmpegVersion, ffprobeVersion] = await Promise.all([
    runCheck(paths.ffmpeg, 'ffmpeg'),
    runCheck(paths.ffprobe, 'ffprobe'),
  ])
  return ffmpegVersion && ffprobeVersion
    ? { available: true, path: `${ffmpegVersion} (${paths.ffmpeg})` }
    : { available: false, path: '' }
}
