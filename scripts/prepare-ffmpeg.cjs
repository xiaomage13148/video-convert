const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const resourcesDir = path.resolve(__dirname, '../resources')
const filenames = ['ffmpeg.exe', 'ffprobe.exe']

function validateResources(dir) {
  for (const filename of filenames) {
    const binary = path.join(dir, filename)
    if (!fs.existsSync(binary) || !fs.statSync(binary).isFile()) {
      throw new Error(`缺少 ${binary}。请先运行 npm run prepare:ffmpeg -- "包含 ffmpeg.exe 和 ffprobe.exe 的目录"`)
    }
    const output = execFileSync(binary, ['-version'], {
      encoding: 'utf8', timeout: 10000, windowsHide: true,
    })
    if (!output.startsWith(`${path.basename(filename, '.exe')} version `)) {
      throw new Error(`${binary} 不是有效的 FFmpeg 程序`)
    }
    console.log(`[FFmpeg] ${output.split(/\r?\n/)[0]}`)
  }
}

// electron-builder 的 beforePack 钩子：直接运行 builder 也不能漏打资源。
module.exports = async function beforePack() {
  validateResources(resourcesDir)
}

if (require.main === module) {
  try {
    const sourceDir = process.argv[2] ? path.resolve(process.argv[2]) : resourcesDir
    validateResources(sourceDir)
    if (sourceDir !== resourcesDir) {
      fs.mkdirSync(resourcesDir, { recursive: true })
      for (const filename of filenames) {
        fs.copyFileSync(path.join(sourceDir, filename), path.join(resourcesDir, filename))
      }
    }
    console.log(`[FFmpeg] 打包资源已就绪：${resourcesDir}`)
  } catch (error) {
    console.error(`[FFmpeg] ${error.message}`)
    process.exitCode = 1
  }
}
