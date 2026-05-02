import { exec } from 'child_process'

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
  return new Promise((resolve) => {
    exec('ffmpeg -version', { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) {
        resolve({ available: false, path: '' })
        return
      }

      const pathMatch = stdout.match(/ffmpeg version\s+(\S+)/)
      resolve({
        available: true,
        path: pathMatch ? pathMatch[1] : 'installed',
      })
    })
  })
}
