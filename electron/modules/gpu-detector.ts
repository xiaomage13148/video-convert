import { exec, execFile } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

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

function getFFmpegSearchPaths(): string[] {
  const paths: string[] = []
  const home = process.env.USERPROFILE || process.env.HOME || ''

  const candidates = [
    'C:\\ffmpeg\\bin',
    'C:\\Program Files\\ffmpeg\\bin',
    'C:\\Program Files (x86)\\ffmpeg\\bin',
    'C:\\ProgramData\\chocolatey\\bin',
    'D:\\ffmpeg\\bin',
  ]
  if (home) {
    candidates.push(
      path.join(home, 'scoop', 'shims'),
      path.join(home, 'scoop', 'apps', 'ffmpeg', 'current', 'bin'),
      path.join(home, '.local', 'bin'),
    )
  }

  for (const dir of candidates) {
    const fullPath = path.join(dir, 'ffmpeg.exe')
    if (existsSync(fullPath)) {
      paths.push(dir)
    }
  }

  return paths
}

function parseVersionOutput(output: string, actualPath?: string): string {
  const match = output.match(/ffmpeg version\s+(\S+)/)
  const version = match ? match[1] : 'installed'
  return actualPath ? `${version} (${actualPath})` : version
}

export async function checkFFmpeg(): Promise<{ available: boolean; path: string }> {
  const runCheck = (cmd: string, env?: NodeJS.ProcessEnv): Promise<{ available: boolean; path: string }> => {
    return new Promise((resolve) => {
      exec(cmd, { maxBuffer: 1024 * 1024, env }, (error, stdout, stderr) => {
        const output = stdout + '\n' + stderr
        console.log(`FFmpeg check command: ${cmd}`)
        console.log(`FFmpeg check error: ${error}`)
        console.log(`FFmpeg check stdout: ${stdout}`)
        console.log(`FFmpeg check stderr: ${stderr}`)
        if (!error || output.includes('ffmpeg version')) {
          const versionMatch = output.match(/ffmpeg version\s+(\S+)/)
          const version = versionMatch ? versionMatch[1] : 'installed'
          resolve({ available: true, path: version })
          return
        }
        resolve({ available: false, path: '' })
      })
    })
  }

  console.log('Starting FFmpeg check...')
  const result = await runCheck('ffmpeg -version')
  if (result.available) {
    console.log('FFmpeg found via PATH: true')
    return result
  }

  const searchPaths = getFFmpegSearchPaths()
  console.log('Searching common FFmpeg paths:', searchPaths)
  for (const dir of searchPaths) {
    const ffmpegPath = path.join(dir, 'ffmpeg.exe')
    console.log('Trying:', ffmpegPath)
    const result2 = await runCheck(`"${ffmpegPath}" -version`)
    if (result2.available) {
      console.log('FFmpeg found via path:', ffmpegPath)
      return { available: true, path: `${result2.path} (${ffmpegPath})` }
    }
  }

  const localFFmpeg = path.join(process.resourcesPath || '', 'ffmpeg.exe')
  console.log('Checking local FFmpeg path:', localFFmpeg)
  if (existsSync(localFFmpeg)) {
    const result3 = await runCheck(`"${localFFmpeg}" -version`)
    if (result3.available) {
      console.log('FFmpeg found via local path: true')
      return { available: true, path: `${result3.path} (${localFFmpeg})` }
    }
  }

  console.log('FFmpeg not found')
  return { available: false, path: '' }
}
