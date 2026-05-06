# FFmpeg 集成方案

## Context
当前项目要求用户预先安装 FFmpeg 并加入 PATH，增加了使用门槛。目标是将 FFmpeg 二进制打包进应用，实现开箱即用。采用 `ffmpeg-static` + `ffprobe-static` npm 包快速集成，后续再考虑 CUDA 支持的自定义二进制方案。

## 改动文件清单

### 1. 安装依赖
```bash
yarn add ffmpeg-static ffprobe-static
yarn add -D @types/ffmpeg-static @types/ffprobe-static
```

### 2. 新建 `electron/modules/ffmpeg-paths.ts`
路径解析工具，处理开发/生产环境差异：
- `getFFmpegPath()` — 返回 ffmpeg 可执行文件路径
- `getFFprobePath()` — 返回 ffprobe 可执行文件路径
- 开发环境：直接使用 `ffmpeg-static` / `ffprobe-static` 包导出的路径
- 生产环境：从 `process.resourcesPath` 下的 `ffmpeg/ffmpeg.exe` 和 `ffmpeg/ffprobe.exe` 读取

### 3. 修改 `electron/modules/ffmpeg-runner.ts`
- `detectVideoCodec()` (L35): 字符串拼接改为使用 `getFFprobePath()` + spawn 数组参数
- `getVideoDuration()` (L50, L60): 同上，两处 exec 调用改为 spawn
- `runFFmpeg()` (L199): `spawn('ffmpeg', ...)` 改为 `spawn(getFFmpegPath(), ...)`

### 4. 修改 `electron/modules/gpu-detector.ts`
- `checkFFmpeg()` (L64): `exec('ffmpeg -version')` 改为 `exec(\`"${getFFmpegPath()}" -version\`)`

### 5. 修改 `electron-builder.yml`
添加 `extraResources` 配置，将 ffmpeg/ffprobe 二进制打包：
```yaml
extraResources:
  - from: node_modules/ffmpeg-static/ffmpeg.exe
    to: ffmpeg/ffmpeg.exe
  - from: node_modules/ffprobe-static/bin/win64/ffprobe.exe
    to: ffmpeg/ffprobe.exe
```

### 6. 更新 `readme.md`
移除"需要安装 FFmpeg"的要求说明。

## 验证方式
1. `yarn dev` 启动开发环境，确认 FFmpeg 检测通过
2. 执行一次视频转换，确认进度正常、输出文件可用
3. `yarn electron:build` 打包后安装，确认打包应用中 FFmpeg 正常工作
