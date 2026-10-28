# FFmpeg 打包资源

将 Windows 版 `ffmpeg.exe` 和 `ffprobe.exe` 放在此目录。可从已有资源目录导入：

```powershell
npm run prepare:ffmpeg -- "D:/MyData/MyWork/2026/Code/video-lens/resources"
```

导入后运行 `npm run electron:build`，两个程序会随安装包复制到应用的 `resources/` 目录（位于 `app.asar` 外，可直接执行）。开发模式也优先使用本目录中的程序。

打包前会验证两个程序均存在且可执行；缺少资源时会中止并显示导入方法。大型二进制文件已在 `.gitignore` 中排除，新检出项目或 CI 构建前需单独准备。

替换版本时同时更新这两个程序。如果使用依赖 DLL 的动态构建，还需补齐 DLL 并调整 `extraResources`；推荐使用可独立运行的静态构建。

分发 FFmpeg 时，应同时遵守所使用构建的许可证及源码提供要求。
