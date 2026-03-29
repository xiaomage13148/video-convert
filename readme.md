# 视频格式转换工具

## 项目初衷

从IDM或NDM下载的视频资源后缀格式多为ts，为了快捷批量将视频转换为mp4格式，特开发此脚本。现在已扩展支持多种视频格式的转换。

## 功能特性

### 📁 支持的输入格式
- `.ts` (MPEG-TS 传输流)
- `.mkv` (Matroska 视频)
- `.avi` (音频视频交错格式)
- `.mov` (QuickTime 视频)
- `.wmv` (Windows Media Video)
- `.flv` (Flash 视频)
- `.webm` (WebM 视频)
- `.m4v` (MPEG-4 视频)
- `.mpg`/`.mpeg` (MPEG 视频)
- `.3gp` (3GPP 视频)
- `.m2ts`/`.mts` (Blu-ray/AVCHD 视频)

### ⚡ 硬件加速
- **CUDA 加速**：针对 NVIDIA 显卡优化，支持 RTX 5070 等最新显卡
- **智能编码检测**：自动识别输入视频编码格式并选择最佳解码器
- **多线程处理**：支持同时处理多个文件，提高转换效率

## 基础配置

### 1. 安装 FFmpeg
- Windows 系统：安装 FFmpeg 并配置环境变量
  - 参考教程：[Windows 电脑 FFmpeg 安装教程](https://blog.csdn.net/csdn_yudong/article/details/129182648)
- 确保 `ffmpeg` 和 `ffprobe` 命令可以在命令行中直接执行

### 2. 显卡支持
- **NVIDIA 显卡**：默认使用 CUDA 加速，已针对 RTX 5070 优化
- **其他显卡**：可修改 `worker.js` 中的编码参数

## 使用方法

### 1. 配置输入目录
编辑 `video/thread/tsToMp4Thread.js` 文件中的 `inputDir` 变量：

```javascript
// 指定视频文件所在的目录
const inputDir = 'D:\\NDM下载\\Video'; // 你的视频目录路径
```

### 2. 运行转换

```bash
# 在项目根目录执行
node video/thread/tsToMp4Thread.js
```

### 3. 查看转换结果
- 转换后的文件会保存在同一目录，后缀为 `.mp4`
- 转换完成后会自动删除原始文件

## 技术参数

### RTX 5070 优化参数
```bash
# 编码参数
-c:v h264_nvenc      # 使用 NVENC H.264 编码器
-preset p1           # 最快预设
-tune hq             # 高质量调优
-rc vbr              # 可变比特率
-cq 23               # 质量因子 (类似 CRF)
-b:v 0               # 不限制比特率
-bufsize 16M         # 缓冲区大小
-profile:v high      # High Profile
-level 5.1           # 支持 4K@30fps
```

### 硬件解码器支持
- **H.264**：`h264_cuvid`
- **HEVC/H.265**：`hevc_cuvid`
- **MPEG-2**：`mpeg2_cuvid`
- **MPEG-4**：`mpeg4_cuvid`
- **VP9**：`vp9_cuvid`

## 注意事项

1. **文件路径**：确保输入目录路径正确，且包含需要转换的视频文件
2. **权限**：确保程序有读取和写入目录的权限
3. **空间**：确保目标磁盘有足够的空间存储转换后的文件
4. **显卡驱动**：建议更新到最新的 NVIDIA 显卡驱动以获得最佳性能

## 示例

### 转换单个文件
将目录中的 `example.ts` 转换为 `example.mp4`

### 批量转换
将目录中的所有支持格式的视频文件批量转换为 `.mp4` 格式

## 故障排除

- **FFmpeg 未找到**：检查 FFmpeg 是否已正确安装并配置环境变量
- **CUDA 错误**：检查显卡驱动是否最新，或尝试修改 `worker.js` 中的 CUDA 参数
- **转换失败**：检查输入文件是否损坏，或尝试使用不同的编码参数

## 项目结构

```
video-convert/
├── video/
│   └── thread/
│       ├── tsToMp4Thread.js   # 主脚本，处理文件列表和多线程
│       └── worker.js           # 工作线程，执行 FFmpeg 转换
└── readme.md                   # 项目说明
```
