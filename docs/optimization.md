# video-convert 项目优化建议

> 评审日期：2026-09-03
> 评审范围：`electron/`（主进程、preload、IPC）、`src/`（Vue 3 渲染进程）、`electron-builder.yml`、`video/`（遗留代码）

## 总体评价

项目整体架构清晰，已有不少良好实践：

- IPC 通道集中定义（`electron/ipc/channels.ts`），preload 桥接规范，`contextIsolation: true` + `nodeIntegration: false` 安全配置正确

- 转换队列有并发控制，进度/日志上报做了节流（200ms/500ms），任务结束后清理监听器和进程引用

- CUDA 解码失败自动回退 CPU，FFmpeg 参数对 TS 流格式、字幕流、muxing 队列等边界做了容错

- 前端 Pinia 状态划分合理，日志有上限裁剪，支持导出

以下问题按 **P0（正确性 Bug）→ P1（数据安全与健壮性）→ P2（性能）→ P3（体验与工程化）** 分级列出。

***

## P0 正确性 Bug（正常使用路径上必现）

### 1. 取消任务后状态被覆盖为「失败」

> ✅ **已修复（2026-09-03）**：`processTask` 的 catch 开头检测 `task.status === 'cancelled'` 提前返回，仅清理残缺输出文件，不再覆盖状态、不再发送失败消息；另在 `getVideoInfo` 探测完成后增加取消检查，堵住「探测期间取消被 converting 状态覆盖」的窗口。

- **位置**：`electron/modules/converter.ts` L264-296（`processTask` 的 catch）、L307-344（`cancel`）

- **问题**：`cancel()` 先将 `task.status = 'cancelled'` 再 `kill('SIGKILL')`。进程被杀后 FFmpeg 退出码非 0，`await promise` 抛异常进入 catch，catch 无条件执行 `task.status = 'failed'`，**覆盖了已取消状态**。

- **影响**：取消的任务在 UI 显示为「转换失败」，失败计数虚高，误导用户。

- **修复**：catch 开头检查取消状态：

```ts
} catch (err: any) {
  if (task.status === 'cancelled') return  // 已取消，不按失败处理
  task.status = 'failed'
  ...
}
```

（注意 `finally` 中的 `cleanupTask` 仍会执行，不受影响。）

### 2. CUDA 回退时 `Object.assign` 替换进程对象，取消功能失效

> ✅ **已修复（2026-09-03）**：删除 `Object.assign` 进程偷换逻辑，`runFFmpeg` 不再返回进程引用，新增 `onProcess` 回调——每次实际 spawn（含 CUDA 回退后的 CPU 进程）都通过回调同步给调用方；`converter` 在回调中更新 `task.process`，并在回调内检测已取消状态时直接 kill 新进程，堵住回退窗口期的孤儿进程。`ConvertTask.process` 类型同步改为 `ChildProcess`。

- **位置**：`electron/modules/ffmpeg-runner.ts` L336-337

- **问题**：CUDA 解码失败回退 CPU 时，用 `Object.assign(firstProc, cpuProc)` 试图"偷换"外部持有的进程引用。但 `kill()`、`pid` 等是 `ChildProcess` 原型方法/内部状态，`Object.assign` 只复制自有可枚举属性，**外部调用** **`firstProc.kill()`** **杀的仍是早已退出的旧进程**。

- **影响**：CUDA 回退到 CPU 后，取消该任务时新 FFmpeg 进程杀不掉，成为孤儿进程继续后台转码，输出文件照常生成，与 UI 状态（已取消）不一致。

- **修复**：改为由调用方持有可变引用，例如通过回调注入：

```ts
export function runFFmpeg(options: FFmpegOptions & {
  onProcess?: (proc: ChildProcess) => void
}): { promise: Promise<void> } {
  const { promise: firstPromise, process: firstProc } = spawnFFmpegProcess(args, options)
  options.onProcess?.(firstProc)

  const finalPromise = firstPromise.catch((err) => {
    if (!useCuda) throw err
    const { promise: cpuPromise, process: cpuProc } = spawnFFmpegProcess(cpuArgs, options)
    options.onProcess?.(cpuProc)  // 外部引用指向新进程，取消仍然有效
    return cpuPromise
  })
  return { promise: finalPromise }
}
```

`converter.ts` 中对应改为 `runFFmpeg({ ..., onProcess: (p) => { task.process = p } })`。

### 3. FFmpeg 检测到的路径与实际调用脱节

> ✅ **已修复（2026-10-28）**：新增 `ffmpeg-paths.ts` 统一解析并缓存 FFmpeg/FFprobe 路径。内置 resources 优先，其次 PATH 和常见安装目录；可用性检测、探测和转码共用同一组路径，并校验两个程序均可启动。

- **位置**：`electron/modules/gpu-detector.ts`（`checkFFmpeg` 搜索了 `C:\ffmpeg\bin` 等常见路径）、`electron/modules/ffmpeg-runner.ts` L236（`spawn('ffmpeg', args)`）、L37/52/62/80（`ffprobe`）

- **问题**：`checkFFmpeg` 找到的完整路径只用于界面展示；实际转换/探测仍直接 `spawn('ffmpeg')`，完全依赖 `PATH` 环境变量。

- **影响**：FFmpeg 装在 `C:\ffmpeg\bin` 但未加入 PATH 的机器上，应用检测显示「FFmpeg 可用」，但所有转换任务 `spawn ENOENT` 全部失败。检测与执行结果自相矛盾。

- **修复**：主进程启动时解析一次 FFmpeg/FFprobe 绝对路径（PATH → 常见路径 → 应用 resources 目录），注入 runner 模块：

```ts
// ffmpeg-runner.ts
let ffmpegPath = 'ffmpeg'
export function setFFmpegPath(p: string) { ffmpegPath = p }
// spawn(ffmpegPath, args)
```

### 4. 选择 HEVC 编码器时 Profile/Level 参数非法

- **位置**：`src/components/SettingsPanel.vue` L105-114（Profile 选项固定为 h264 的 baseline/main/high/high10，且不随编码器联动）、`electron/modules/ffmpeg-runner.ts` L153-154（nvenc 分支无条件 push `-profile:v` / `-level`）

- **问题**：HEVC（`hevc_nvenc`/`libx265`）的合法 profile 是 `main` / `main10` / `main-rext`，level 的取值范围也与 h264 不同。当前 UI 无论选什么编码器，profile 都是 h264 的值。

- **影响**：用户选择 HEVC 编码器（默认 profile 为 `high`）后所有转换直接报错失败。

- **修复**：profile/level 下拉选项根据编码器联动（`computed`），切换编码器时自动修正为合法值；或在 `buildFFmpegArgs` 中按编码器做映射兜底。

### 5. 转换过程中退出应用，FFmpeg 子进程不清理

> ✅ **已修复（2026-09-03）**：`main.ts` 注册 `app.on('before-quit', () => converter.cancel())`，退出前终止所有运行中的 FFmpeg 子进程（`send()` 已有 `isDestroyed()` 防护，窗口销毁后发送消息安全）。转换中关窗的二次确认提示仍保留在建议清单（见 P3-6），未在本批实现。

- **位置**：`electron/main.ts` L168-172（`window-all-closed` 直接 `app.quit()`）

- **问题**：`spawn` 出来的 FFmpeg 子进程默认不会随父进程退出。转换中直接关窗/退出，FFmpeg 仍在后台继续转码。

- **影响**：后台持续占用 GPU/CPU/磁盘，产生用户不知情的半成品文件；配合「转换成功后删除原文件」选项，还可能出现原文件被删但用户以为什么都没发生。

- **修复**：

```ts
app.on('before-quit', () => {
  converter.cancel()  // kill 所有运行中的 FFmpeg 进程
})
```

另建议：转换中关闭窗口时弹二次确认（见 P3-6）。

***

## P1 数据安全与健壮性

### 6. 同名输出文件被静默覆盖删除，`checkOutputExists` 是死代码

- **位置**：`electron/modules/scanner.ts` L80（`checkOutputExists` 定义后从未被调用，仅被 import）、`electron/modules/ffmpeg-runner.ts` L303-309（转换前直接 `unlinkSync` 已存在的输出文件）

- **影响**：输出目录下已存在同名 `.mp4`（例如之前转好、或源目录本身就有）时，旧文件被无提示删除后重写，**数据丢失且不可恢复**。

- **修复**：扫描或启动转换前调用 `checkOutputExists` 批量检测，存在冲突时向用户提供「跳过 / 覆盖 / 自动重命名（如 `name (1).mp4`）」选项；至少在日志中明确警告。

### 7. 「转换后删除原文件」是永久删除

- **位置**：`electron/modules/converter.ts` L241-247（`fs.unlinkSync(task.inputPath)`）

- **影响**：默认配置 `deleteOriginal: true`，转换成功即永久删除源文件。一旦输出文件有问题（如转码花屏、音画不同步、极少数情况下 FFmpeg 退出码 0 但产物损坏），源文件已无法找回。

- **修复**：改用 Electron 的 `shell.trashItem(task.inputPath)` 移入回收站，给用户反悔余地；性能差异可忽略（每文件一次调用）。

### 8. ffprobe 用 `exec` + 字符串拼接路径

> ✅ **已修复（2026-10-28）**：所有 FFprobe 调用改为 `execFile` 和参数数组，时长回退探测同样使用统一路径，支持中文、空格及 shell 特殊字符文件名。

- **位置**：`electron/modules/ffmpeg-runner.ts` L37、L52、L62、L80

- **问题**：`exec(\`ffprobe ... "${filePath}"\`)`经过 shell 解析。路径中包含`"`、结尾反斜杠、`&`、`%  ` 等字符时命令解析失败，`codec`探测返回`unknown\`，导致解码器选择降级。

- **修复**：改用 `execFile('ffprobe', [...args])` 传参数组，不经过 shell，天然规避转义/注入问题。

### 9. 转换进行中可再次 `startConversion`，产生孤儿进程

- **位置**：`electron/modules/converter.ts` L100-105（`startConversion` 无运行中守卫，直接 `this.tasks.clear()`）

- **问题**：前端 `ControlBar` 有 `isConverting` 防护，但主进程无兜底。一旦前端状态不同步（如异常路径漏置标志），再次 start 会清掉 tasks 表，正在运行的 FFmpeg 进程引用丢失、无法取消。

- **修复**：`startConversion` 入口检查 `this.activeCount > 0 || this.queue.length > 0` 时，先 `cancel()` 全部或直接拒绝并返回错误。

### 10. 前端完成回调把未完成任务强制标记为「成功」

- **位置**：`src/views/HomeView.vue` L57-63（`onConvertComplete` 中把所有 `converting`/`waiting` 任务强制置为 `success`）

- **问题**：这是一段「兜底假数据」逻辑，会掩盖主进程状态同步的真实 bug（正常情况下收到 complete 时不应还有 running 任务）。被掩盖的失败会让用户误以为全部成功。

- **修复**：删除该强制逻辑。若担心状态不同步，应让主进程的 `CONVERT_COMPLETE` 事件携带**完整任务状态快照**，前端以快照为准覆盖本地状态。

### 11. 失败信息缺乏诊断价值

- **位置**：`electron/modules/ffmpeg-runner.ts` L280（错误只有 `FFmpeg exited with code ${code}`）

- **影响**：用户无法得知失败原因（编解码器不支持、参数非法、文件损坏等），只能反复重试。

- **修复**：进程 close 时保留 stderr 的最后若干行（如 20 行，`stderrBuffer` 已有内容，截断即可），随错误信息一起上报，在 UI 失败详情中展示。

***

## P2 性能优化

### 12. 每个任务探测视频信息要起 3 个 ffprobe 进程

- **位置**：`electron/modules/ffmpeg-runner.ts` L92-99（`getVideoInfo` 并发调用 detectVideoCodec / getVideoDuration / detectAudioCodec）

- **影响**：批量转换 1000 个文件 = 额外创建 3000 个进程，Windows 上进程创建开销显著，且每个都有 fallback 的串行等待。

- **修复**：一次调用拿全部信息：

```ts
execFile('ffprobe', [
  '-v', 'error', '-print_format', 'json',
  '-show_format', '-show_streams', filePath,
], (err, stdout) => {
  // 从 JSON 中解析 v:0 的 codec_name、a:0 的 codec_name、format.duration（含 stream duration 兜底）
})
```

### 13. 目录扫描是同步 IO，阻塞主进程

- **位置**：`electron/modules/scanner.ts` L28-71（`readdirSync`/`statSync` 递归）

- **影响**：扫描在主进程 IPC handler 中同步执行，大目录（数千文件）或网络盘/移动硬盘上会冻结主进程——期间所有 IPC（包括窗口操作）无响应。前端虽有 `isLoading` 状态，但扫描期间 UI 实际完全卡死。

- **修复**：改为 `fs.promises` + 有限并发遍历（如 p-limit 8\~16）；超大目录可进一步移入 `worker_threads`。

### 14. 任务状态查找 O(n²)，已有 Map 未使用

- **位置**：`src/stores/convert.ts` L61-68（`updateTaskProgress` 用 `find` 线性查找）、L11-17（`tasks` Map computed 定义了却没人用）、`src/components/FileList.vue` L22-31（`getTaskForFile` 每个文件每帧线性查找）

- **影响**：进度消息以 200ms×并发数 的频率到达，每条触发全列表重渲染；文件数上千时明显掉帧。

- **修复**：`updateTaskProgress` 改用 `tasks.value.get(data.id)`；`FileCard` 改为从 store 取 `tasks` Map 做响应式查找（`computed`），去掉逐文件函数调用。

### 15. 初始任务状态逐条发送 IPC

- **位置**：`electron/modules/converter.ts` L129-137（`startConversion` 循环内逐文件 `send(CONVERT_STATUS)`）

- **影响**：1000 个文件 = 1000 条 IPC 消息，渲染进程逐条处理。

- **修复**：改为一次性发送任务数组（新增 `CONVERT_TASKS` 消息或复用现有 payload 结构），前端批量构建 `taskList`。

### 16. 失败重试时重复探测视频信息

- **位置**：`converter.ts` `retryFailed` → `processTask` 重新执行 `getVideoInfo`

- **修复**：`task` 上缓存已探测的 `codec/duration/audioCodec`，重试时跳过探测（结合 P2-12 效果更佳）。低优先级。

***

## P3 体验与工程化

### 17. 打包产物不包含 FFmpeg（分发最大短板）

> ✅ **已修复（2026-10-28）**：通过 `extraResources` 将 `resources/ffmpeg.exe` 和 `resources/ffprobe.exe` 放在 `app.asar` 外。新增资源导入脚本及 `beforePack` 校验，资源缺失或不能执行时中止打包。

- **位置**：`electron-builder.yml`（`files` 仅 `dist`/`dist-electron`）

- **影响**：新机器必须手动安装 FFmpeg 并配置 PATH 才能使用（且受 P0-3 影响，实际上必须配 PATH）。对普通用户几乎不可用。

- **修复**：构建时将 ffmpeg/ffprobe 二进制放入 `extraResources`（可借助 `ffmpeg-static` 或下载脚本），主进程启动时优先使用 `process.resourcesPath` 下的版本，其次 PATH。注意 ffmpeg-static 的 GPL/构建版本合规问题。

### 18. NVENC 并发会话数限制未处理

- **位置**：`src/components/ControlBar.vue`（concurrency 上限 6）、`converter.ts`

- **问题**：消费级 NVIDIA 显卡驱动限制并发 NVENC 编码会话数（旧驱动 3 个，新驱动 5\~8 个）。超出限制时 NVENC 初始化失败，触发 CUDA 回退逻辑——但回退只关闭硬件解码，**编码器仍是 nvenc**，任务必然再次失败。

- **修复**：检测会话数限制（新版驱动可通过 `nvidia-smi` 查询，或启动一个探测编码）；至少在并发数设置处提示该风险，并在编码器初始化失败时给出明确错误而非静默重试。

### 19. 「暂停」语义与用户预期不符

- **位置**：`converter.ts` L298-300（`pause()` 只停止派发新任务）

- **影响**：点暂停后，运行中的任务进度条仍在走，用户会困惑「暂停没生效」。

- **修复**（低成本方案）：UI 文案改为「暂停（运行中的 N 个任务将继续完成）」；真暂停需要信号机制（Windows 不支持 SIGSTOP，需 kill 后记录断点重新转码，成本较高，不建议）。

### 20. 拖拽只处理第一个路径

- **位置**：`src/views/HomeView.vue` L88-102（`handleDrop` 只取 `files[0].path`）

- **修复**：遍历 `dataTransfer.files`，目录逐个扫描合并，普通视频文件直接加入列表。

### 21. `video/` 目录是遗留死代码

- **位置**：`video/thread/tsToMp4Thread.js`、`video/thread/worker.js`

- **问题**：全项目代码无引用（仅 `readme.md`、`docs/plans.md` 提及），是 Node CLI 时代的残留。会被全局搜索/TS 编译配置误伤，增加维护噪音。

- **修复**：确认后删除，或移入 `docs/legacy/` 归档并注明来源。

### 22. 主进程调试日志无轮转

- **位置**：`electron/main.ts` L11-16（`appendFileSync` 写 `%TEMP%\video-convert-debug.log`）

- **影响**：文件无限增长；每条日志一次同步写。且 `debugLog` 在正式路径上记录了大量调试细节（含完整扫描结果前 500 字符）。

- **修复**：启动时检查大小超限（如 5MB）则重置；生产构建可关闭 verbose 级别日志。

### 23. 设置存储高频同步读写

- **位置**：`electron/main.ts` L79、L91（每次选目录/扫描都触发 `addRecentDir` → `loadSettings` + `saveSettings` 两次同步文件 IO）

- **修复**：内存缓存 settings，写入做防抖（如 500ms）落盘；或仅当 recentDirs 实际变化时才写。

### 24. IPC 参数无校验

- **位置**：`electron/main.ts` L102-120（`CONVERT_START` 直接信任前端 settings）

- **修复**：主进程对 `encoder`/`preset` 做白名单校验，`quality`/`concurrency` 做 clamp，防止异常值直接拼进 FFmpeg 命令行。本地应用风险低，但属于廉价加固。

***

## 修复路线建议

| 阶段  | 内容              | 状态                                                     |
| --- | --------------- | ------------------------------------------------------ |
| 第一批 | P0-1、P0-2、P0-5  | ✅ 已完成（2026-09-03），取消失效与孤儿进程问题已修复，`vue-tsc --noEmit` 通过 |
| 第二批 | P0-3、P0-4、P1-8  | FFmpeg/ffprobe 路径统一注入 + execFile 改造，一次重构完成             |
| 第三批 | P1-6、P1-7、P1-11 | 数据安全三件套：覆盖确认、回收站删除、失败诊断信息                              |
| 第四批 | P2-12 \~ P2-15  | 性能批次，涉及任务启动链路重构，建议一起做                                  |
| 择机  | P3 各项           | FFmpeg 内置打包建议尽早排期，直接决定分发可用性                            |

### 第一批修复记录（2026-09-03）

**改动文件**：`electron/modules/converter.ts`、`electron/modules/ffmpeg-runner.ts`、`electron/main.ts`

1. **P0-1 取消状态覆盖**：`processTask` 的 catch 检测 `task.status === 'cancelled'` 提前返回，仅清理残缺输出；`getVideoInfo` 之后新增取消检查，防止探测期间取消被 `converting` 状态覆盖
2. **P0-2 CUDA 回退取消失效**：`runFFmpeg` 移除 `Object.assign` 进程偷换与进程返回值，改为 `onProcess` 回调同步每次 spawn 的进程（含 CPU 回退进程）；`converter` 侧在回调中检测取消并直接 kill 新进程
3. **P0-5 退出不清理子进程**：`main.ts` 新增 `before-quit` 钩子调用 `converter.cancel()` 终止全部 FFmpeg

**验证**：`npx vue-tsc --noEmit` 全量类型检查通过。

***

## 附：已确认的良好实践（无需改动）

- preload `contextBridge` 暴露面收敛，`onXxx` 返回取消订阅函数，`useElectron` 内 `onUnmounted` 统一清理

- 进度/日志上报节流 + 任务级 Map 清理，无明显内存泄漏

- FFmpeg 参数对 TS 容错（`-err_detect ignore_err`、`+igndts`、强制 `mpegts` 格式、`-sn` 跳字幕、`-max_muxing_queue_size`）

- Opus/Vorbis/FLAC 音频强制转 AAC 的播放器兼容处理

- 日志前端裁剪（10000 → 5000）、支持搜索/过滤/导出

