import fs from 'fs'
import path from 'path'

const SUPPORTED_FORMATS = ['.ts', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.m2ts', '.mts']

export interface ScannedFile {
  name: string
  path: string
  ext: string
  size: number
  sizeFormatted: string
  relativePath?: string
}

function isSupportedVideoFile(file: string): boolean {
  const ext = path.extname(file).toLowerCase()
  return SUPPORTED_FORMATS.includes(ext)
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function scanDirectory(dir: string, recursive = false, rootDir?: string): ScannedFile[] {
  if (!fs.existsSync(dir)) {
    return []
  }

  const baseDir = rootDir || dir

  try {
    const files = fs.readdirSync(dir)
    const videoFiles: ScannedFile[] = []

    for (const file of files) {
      const filePath = path.join(dir, file)
      try {
        const stat = fs.statSync(filePath)

        if (stat.isDirectory()) {
          if (recursive) {
            videoFiles.push(...scanDirectory(filePath, recursive, baseDir))
          }
          continue
        }

        if (!stat.isFile() || !isSupportedVideoFile(file)) continue

        const relativePath = path.relative(baseDir, filePath)
        videoFiles.push({
          name: path.basename(file, path.extname(file)),
          path: filePath,
          ext: path.extname(file).toLowerCase(),
          size: stat.size,
          sizeFormatted: formatFileSize(stat.size),
          relativePath: recursive && relativePath !== file ? relativePath : undefined,
        })
      } catch {
        // 跳过无法访问的文件/目录
      }
    }

    return videoFiles
  } catch {
    return []
  }
}

export function getOutputPath(inputPath: string, outputDir?: string): string {
  const ext = path.extname(inputPath)
  const baseName = path.basename(inputPath, ext)
  const dir = outputDir || path.dirname(inputPath)
  return path.join(dir, `${baseName}.mp4`)
}

export function checkOutputExists(inputPath: string, outputDir?: string): boolean {
  const outputPath = getOutputPath(inputPath, outputDir)
  return fs.existsSync(outputPath)
}
