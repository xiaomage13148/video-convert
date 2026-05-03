# Video Convert Pro

一款基于 Electron + Vue 3 的桌面端视频格式转换工具，专注于将 IDM/NDM 下载的 `.ts` 视频批量转换为 `.mp4`，支持 NVIDIA CUDA 硬件加速，提供现代化的图形界面操作体验。

## 项目初衷

从 IDM 或 NDM 下载的视频资源后缀格式多为 `.ts`，为了快捷批量将视频转换为 `.mp4` 格式，特开发此工具。项目从最初的 Node.js 命令行脚本演进为完整的桌面应用，现已扩展支持多种视频格式的转换，并提供可视化的任务管理界面。

## 功能特性

### 核心功能

- **批量转换** — 选择目录后自动扫描所有支持的视频文件，一键批量转换
- **并发控制** — 支持 1-6 路并发转换，可动态调整
- **任务管理** — 支持暂停 / 恢复 / 取消 / 重试，灵活控制转换流程
- **实时进度** — 单文件进度条 + 全局进度百分比，实时显示转换状态
- **日志系统** — 实时日志查看，支持搜索、按级别筛选、导出为 txt 文件
- **预设方案** — 内置快速 / 均衡 / 高质三套编码预设，一键切换

### 支持的输入格式

| 格式 | 说明 |
|------|------|
| `.ts` | MPEG-TS 传输流 |
| `.mkv` | Matroska 视频 |
| `.avi` | 音频视频交错格式 |
| `.mov` | QuickTime 视频 |
| `.wmv` | Windows Media Video |
| `.flv` | Flash 视频 |
| `.webm` | WebM 视频 |
| `.m4v` | MPEG-4 视频 |
| `.mpg` / `.mpeg` | MPEG 视频 |
| `.3gp` | 3GPP 视频 |
| `.m2ts` / `.mts` | Blu-ray / AVCHD 视频 |

### 硬件加速

- **NVIDIA CUDA 加速** — 自动检测 GPU，支持 NVENC 硬件编码
- **智能编码检测** — 通过 ffprobe 自动识别输入视频编码，选择最佳 CUVID 解码器
- **自动降级** — 未检测到 GPU 时自动切换至 CPU 编码（libx264 / libx265）

### 编码器支持

| 类型 | 编码器 | 说明 |
|------|--------|------|
| GPU | h264_nvenc | NVIDIA H.264 硬件编码 |
| GPU | hevc_nvenc | NVIDIA H.265 硬件编码 |
| CPU | libx264 | H.264 软件编码 |
| CPU | libx265 | H.265 软件编码 |

## 界面预览

应用采用暗色主题 + 毛玻璃（Glassmorphism）设计风格：

- **标题栏** — 自定义无边框窗口，支持拖拽移动
- **目录选择器** — 原生目录选择对话框，支持最近使用目录记录（最多 5 个）
- **文件列表** — 搜索、格式筛选、全选 / 反选，显示文件名、格式、大小、编码信息
- **控制面板** — 开始 / 暂停 / 取消 / 重试按钮，并发数调节
- **设置面板** — 编码器、预设、质量、CUDA 开关、音频处理、是否删除原文件等
- **状态栏** — 显示 FFmpeg 安装状态和 GPU 信息

## 环境要求

### 必需

- **Node.js** >= 16
- **FFmpeg** — 需安装并配置到系统环境变量，确保 `ffmpeg` 和 `ffprobe` 命令可用
  - 安装参考：[Windows FFmpeg 安装教程](https://blog.csdn.net/csdn_yudong/article/details/129182648)

### 可选

- **NVIDIA 显卡** — 支持 CUDA 的显卡可启用硬件加速，建议更新至最新驱动

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

启动 Vite 开发服务器 + Electron 窗口，支持热重载。

### 构建打包

```bash
npm run electron:build
```

使用 electron-builder 打包为 Windows NSIS 安装程序，输出到 `release/` 目录。

### 仅构建前端

```bash
npm run build
```

## 使用方法

1. 启动应用后，点击「选择目录」或直接拖拽文件夹到窗口
2. 文件列表自动加载所有支持格式的视频文件
3. 使用搜索和格式筛选快速定位目标文件，勾选需要转换的文件
4. 在设置面板中选择编码方案（快速 / 均衡 / 高质）或自定义参数
5. 调整并发数（默认 3），点击「开始转换」
6. 实时查看每个文件的转换进度和全局进度
7. 转换完成后，可在设置中开启「自动删除原文件」

## 技术架构

```
┌─────────────────────────────────────────────────────┐
│                   Renderer Process                   │
│          Vue 3 + Pinia + TDesign + Tailwind         │
│                                                      │
│  HomeView ─┬─ DirSelector   FileList ── FileCard    │
│            ├─ ControlBar    GlobalProgress           │
│            ├─ LogPanel      SettingsPanel            │
│            └─ StatusBar     TitleBar                 │
│                       │                              │
│              useElectron (composable)                │
│                       │                              │
├───────────── contextBridge (preload.ts) ─────────────┤
│                       │                              │
│                    Main Process                      │
│          Electron 28 + Node.js Modules               │
│                                                      │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │ scanner  │ │  converter   │ │  ffmpeg-runner   │  │
│  │ 文件扫描 │ │  任务队列调度 │ │ FFmpeg 进程管理  │  │
│  └──────────┘ └──────────────┘ └─────────────────┘  │
│  ┌──────────────┐ ┌──────────────────┐              │
│  │ gpu-detector │ │  settings-store   │              │
│  │ GPU/FFmpeg检测│ │  设置持久化存储   │              │
│  └──────────────┘ └──────────────────┘              │
└─────────────────────────────────────────────────────┘
```

### IPC 通信

主进程与渲染进程通过 16 个 IPC 通道通信，涵盖目录选择、文件扫描、转换控制（开始 / 暂停 / 恢复 / 取消 / 重试）、进度推送、日志推送、GPU 检测、设置读写等。进度更新节流为 200ms 间隔，避免 IPC 洪泛。

### 安全设计

- Context Isolation 已启用，Node Integration 已禁用
- 所有系统级操作仅在主进程执行，渲染进程通过 preload 脚本暴露的 `window.electronAPI` 接口访问

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Vue 3 (Composition API) | 3.4 |
| 桌面框架 | Electron | 28.2 |
| 构建工具 | Vite | 5.1 |
| UI 组件库 | TDesign Vue Next | 1.9 |
| 状态管理 | Pinia | 2.1 |
| CSS 框架 | Tailwind CSS | 3.4 |
| 图标库 | lucide-vue-next | 0.344 |
| 开发语言 | TypeScript | 5.3 |
| 打包工具 | electron-builder | 24.9 |
| 视频处理 | FFmpeg（外部调用） | 系统安装版 |

## 项目结构

```
video-convert/
├── electron/                        # Electron 主进程
│   ├── main.ts                      # 主进程入口，窗口创建 & IPC 注册
│   ├── preload.ts                   # 安全桥接，暴露 window.electronAPI
│   ├── ipc/
│   │   └── channels.ts              # IPC 通道常量定义
│   └── modules/
│       ├── converter.ts             # 转换任务队列与调度引擎
│       ├── ffmpeg-runner.ts         # FFmpeg 进程管理与进度解析
│       ├── gpu-detector.ts          # NVIDIA GPU & FFmpeg 可用性检测
│       ├── scanner.ts               # 目录扫描，识别支持的视频文件
│       └── settings-store.ts        # 用户设置持久化（JSON 文件）
├── src/                             # Vue 3 渲染进程
│   ├── App.vue                      # 根组件
│   ├── main.ts                      # Vue 应用入口
│   ├── views/
│   │   └── HomeView.vue             # 主页面，协调所有组件
│   ├── components/
│   │   ├── TitleBar.vue             # 自定义无边框标题栏
│   │   ├── DirSelector.vue          # 目录选择器 + 最近目录
│   │   ├── FileList.vue             # 文件列表（搜索 / 筛选 / 批量操作）
│   │   ├── FileCard.vue             # 单文件卡片（进度 / 状态）
│   │   ├── GlobalProgress.vue       # 全局进度条与统计
│   │   ├── ControlBar.vue           # 操作按钮与并发控制
│   │   ├── LogPanel.vue             # 实时日志面板
│   │   ├── SettingsPanel.vue        # 编码设置面板
│   │   └── StatusBar.vue            # 底部状态栏（FFmpeg / GPU）
│   ├── composables/
│   │   └── useElectron.ts           # Electron API 类型化封装
│   ├── stores/
│   │   ├── files.ts                 # 文件列表状态管理
│   │   ├── convert.ts               # 转换任务状态管理
│   │   └── settings.ts              # 设置与预设状态管理
│   ├── types/
│   │   └── index.ts                 # 共享 TypeScript 类型定义
│   └── styles/
│       └── global.css               # Tailwind 基础 + 毛玻璃自定义样式
├── video/                           # 早期 CLI 脚本（保留供参考）
│   └── thread/
│       ├── tsToMp4Thread.js         # 原始主脚本
│       └── worker.js                # 原始工作线程
├── docs/
│   ├── plans.md                     # 项目规划文档
│   └── requirements.md              # 需求规格文档
├── electron-builder.yml             # 打包配置
├── vite.config.ts                   # Vite 构建配置
├── tailwind.config.js               # Tailwind CSS 配置
├── tsconfig.json                    # TypeScript 配置
├── package.json
└── readme.md
```

## 注意事项

1. **FFmpeg 依赖** — 应用本身不包含 FFmpeg，需预先安装并确保在系统 PATH 中
2. **磁盘空间** — 转换过程需要额外磁盘空间存放输出文件，建议预留充足空间
3. **显卡驱动** — 使用 CUDA 加速时，建议安装最新的 NVIDIA 显卡驱动
4. **文件路径** — 支持包含中文和空格的文件路径
5. **原文件处理** — 默认保留原文件，可在设置中开启「转换成功后删除原文件」

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| FFmpeg 未找到 | 检查 FFmpeg 是否已安装并配置到系统 PATH 环境变量 |
| CUDA 不可用 | 更新 NVIDIA 显卡驱动至最新版本，或在设置中切换为 CPU 编码 |
| 转换失败 | 检查输入文件是否损坏，查看日志面板获取详细错误信息 |
| 应用启动慢 | 首次启动时 GPU 检测可能需要几秒，请耐心等待 |
| 输出文件异常 | 尝试在设置中更换编码器或调整质量参数 |

## 许可

本项目仅供个人学习与使用。
