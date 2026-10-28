import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const source = new URL('../build/icon.svg', import.meta.url)
const pngPath = new URL('../build/icon.png', import.meta.url)
const icoPath = new URL('../build/icon.ico', import.meta.url)
const svg = await fs.readFile(source)

await sharp(svg).resize(1024, 1024).png().toFile(fileURLToPath(pngPath))

// ICO 目录中包含多个尺寸的 PNG，供 Windows 在任务栏、快捷方式等位置选择。
const sizes = [16, 24, 32, 48, 64, 128, 256]
const images = await Promise.all(sizes.map((size) => sharp(svg).resize(size, size).png().toBuffer()))
const header = Buffer.alloc(6 + images.length * 16)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(images.length, 4)
let offset = header.length
for (let i = 0; i < images.length; i++) {
  const entry = 6 + i * 16
  header.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], entry)
  header.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], entry + 1)
  header.writeUInt16LE(1, entry + 4)
  header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(images[i].length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += images[i].length
}
await fs.writeFile(icoPath, Buffer.concat([header, ...images]))
console.log('已生成 build/icon.png（1024×1024）和 build/icon.ico（16–256 多尺寸）')
