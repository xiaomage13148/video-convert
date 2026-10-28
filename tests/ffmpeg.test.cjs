const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const childProcess = require('node:child_process')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')

function removeTempDir(dir) {
  assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()))
  fs.rmSync(dir, { recursive: true, force: true })
}

// 直接测试主进程 TypeScript 模块，不启动 Electron 窗口。
function loadModules(mocks, runtime = process) {
  const cache = new Map()
  return function load(name) {
    const filename = path.resolve(root, name)
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText
    const localRequire = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id]
      return id.startsWith('.') ? load(path.resolve(path.dirname(filename), `${id}.ts`)) : require(id)
    }
    new Function('require', 'module', 'exports', 'process', code)(localRequire, module, module.exports, runtime)
    return module.exports
  }
}

function resolverFixture({ packaged = false, files = [] } = {}) {
  const appDir = path.resolve('fixture app 中文')
  const bundledDir = path.resolve('installed app 中文/resources')
  const pathDir = path.resolve('system ffmpeg')
  const existing = new Set(files.map((file) => path.resolve(file)))
  const load = loadModules({
    electron: { app: { isPackaged: packaged, getAppPath: () => appDir } },
    fs: { statSync: (file) => ({ isFile: () => existing.has(file) }) },
  }, { platform: 'win32', resourcesPath: bundledDir, env: { PATH: `"${pathDir}"` } })
  return { appDir, bundledDir, pathDir, getPaths: load('electron/modules/ffmpeg-paths.ts').getFFmpegPaths }
}

test('开发模式优先使用项目 resources，路径含空格和中文', () => {
  const appDir = path.resolve('fixture app 中文')
  const systemDir = path.resolve('system ffmpeg')
  const files = [appDir + '/resources/ffmpeg.exe', appDir + '/resources/ffprobe.exe', systemDir + '/ffmpeg.exe']
  const { getPaths } = resolverFixture({ files })
  assert.deepEqual(getPaths(), {
    ffmpeg: path.join(appDir, 'resources/ffmpeg.exe'), ffprobe: path.join(appDir, 'resources/ffprobe.exe'),
  })
})

test('打包后从 process.resourcesPath 查找，不从 app.asar 查找', () => {
  const dir = path.resolve('installed app 中文/resources')
  const { getPaths } = resolverFixture({ packaged: true, files: [dir + '/ffmpeg.exe', dir + '/ffprobe.exe'] })
  assert.equal(getPaths().ffmpeg, path.join(dir, 'ffmpeg.exe'))
  assert.equal(getPaths().ffprobe, path.join(dir, 'ffprobe.exe'))
})

test('无内置程序时兼容 PATH 和常见安装目录，并缓存执行路径', () => {
  const dir = path.resolve('system ffmpeg')
  const { getPaths } = resolverFixture({ files: [dir + '/ffmpeg.exe', 'C:/ffmpeg/bin/ffprobe.exe'] })
  assert.equal(getPaths().ffmpeg, path.join(dir, 'ffmpeg.exe'))
  assert.equal(getPaths().ffprobe, path.resolve('C:/ffmpeg/bin/ffprobe.exe'))
  assert.equal(getPaths(), getPaths())
})

test('ffprobe 缺失时可用性检测不能报就绪', async () => {
  const load = loadModules({
    './ffmpeg-paths': { getFFmpegPaths: () => ({ ffmpeg: 'bundled/ffmpeg.exe', ffprobe: 'missing/ffprobe.exe' }) },
    child_process: { execFile: (file, args, options, callback) => {
      assert.deepEqual(args, ['-version'])
      assert.equal(options.windowsHide, true)
      callback(file.includes('missing') ? new Error('ENOENT') : null, 'ffmpeg version 8.1.1', '')
    } },
  })
  assert.deepEqual(await load('electron/modules/gpu-detector.ts').checkFFmpeg(), { available: false, path: '' })
})

test('可用性检测验证同一组 ffmpeg 和 ffprobe', async () => {
  const calls = []
  const load = loadModules({
    './ffmpeg-paths': { getFFmpegPaths: () => ({ ffmpeg: 'bundled/ffmpeg.exe', ffprobe: 'bundled/ffprobe.exe' }) },
    child_process: { execFile: (file, args, options, callback) => {
      calls.push(file)
      callback(null, `${file.includes('ffprobe') ? 'ffprobe' : 'ffmpeg'} version 8.1.1`, '')
    } },
  })
  assert.deepEqual(await load('electron/modules/gpu-detector.ts').checkFFmpeg(), {
    available: true, path: '8.1.1 (bundled/ffmpeg.exe)',
  })
  assert.deepEqual(calls, ['bundled/ffmpeg.exe', 'bundled/ffprobe.exe'])
})

test('媒体探测使用参数数组，时长回退同样使用内置 ffprobe', async () => {
  const input = 'D:/中文 空格 & %PATH%/video.ts'
  const calls = []
  const load = loadModules({
    './ffmpeg-paths': { getFFmpegPaths: () => ({ ffprobe: 'bundled/ffprobe.exe' }) },
    child_process: { execFile: (file, args, options, callback) => {
      calls.push(args)
      assert.equal(file, 'bundled/ffprobe.exe')
      assert.equal(args.at(-1), input)
      assert.equal(options.windowsHide, true)
      callback(null, args.includes('format=duration') ? 'N/A' : args.includes('stream=duration') ? '12.5' : 'h264', '')
    } },
  })
  const runner = load('electron/modules/ffmpeg-runner.ts')
  assert.equal(await runner.detectVideoCodec(input), 'h264')
  assert.equal(await runner.detectAudioCodec(input), 'h264')
  assert.equal(await runner.getVideoDuration(input), 12.5)
  assert.equal(calls.length, 4)
})

const ffmpeg = path.join(root, 'resources/ffmpeg.exe')
const ffprobe = path.join(root, 'resources/ffprobe.exe')
test('缺少资源时，准备命令和直接打包的钩子都明确报错', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-convert-guard-'))
  try {
    fs.mkdirSync(path.join(tempDir, 'scripts'))
    const script = path.join(tempDir, 'scripts/prepare-ffmpeg.cjs')
    fs.copyFileSync(path.join(root, 'scripts/prepare-ffmpeg.cjs'), script)
    const result = childProcess.spawnSync(process.execPath, [script], { encoding: 'utf8', windowsHide: true })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /缺少 .*ffmpeg\.exe/)
    assert.match(result.stderr, /npm run prepare:ffmpeg/)
    await assert.rejects(require(script)(), /缺少 .*ffmpeg\.exe/)
  } finally {
    removeTempDir(tempDir)
  }
})

test('真实内置程序在空 PATH 下完成探测和转码（中文、空格及 shell 特殊字符路径）', {
  skip: process.platform !== 'win32' || !fs.existsSync(ffmpeg) || !fs.existsSync(ffprobe),
}, async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-convert 中文 & %PATH% '))
  const env = { ...process.env, PATH: '' }
  try {
    const input = path.join(tempDir, '输入 视频.mp4')
    const output = path.join(tempDir, '输出 视频.mp4')
    childProcess.execFileSync(ffmpeg, [
      '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=64x64:r=10',
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '0.5',
      '-c:v', 'libx264', '-c:a', 'aac', input,
    ], { env, windowsHide: true, timeout: 30000 })
    const load = loadModules({
      electron: { app: { isPackaged: false, getAppPath: () => root } },
      child_process: {
        execFile: (file, args, options, callback) => childProcess.execFile(file, args, { ...options, env }, callback),
        spawn: (file, args, options) => childProcess.spawn(file, args, { ...options, env }),
      },
    }, { platform: process.platform, env, resourcesPath: '' })
    const status = await load('electron/modules/gpu-detector.ts').checkFFmpeg()
    assert.equal(status.available, true)
    assert.ok(status.path.includes(ffmpeg))
    const runner = load('electron/modules/ffmpeg-runner.ts')
    const info = await runner.getVideoInfo(input)
    assert.equal(info.codec, 'h264')
    assert.equal(info.audioCodec, 'aac')
    assert.ok(info.duration > 0)
    await runner.runFFmpeg({
      inputPath: input, outputPath: output, ...info,
      settings: {
        encoder: 'libx264', preset: 'ultrafast', quality: 23, maxBitrate: '0',
        profile: 'high', level: '5.1', audioCopy: true, cudaEnabled: false,
      },
    }).promise
    assert.ok(fs.statSync(output).size > 0)
    assert.equal((await runner.getVideoInfo(output)).codec, 'h264')
  } finally {
    removeTempDir(tempDir)
  }
})
