"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const IPC_CHANNELS = {
  // 对话框
  DIALOG_SELECT_DIRECTORY: "dialog:selectDirectory",
  // 文件扫描
  SCAN_DIRECTORY: "scan:directory",
  // 转换控制
  CONVERT_START: "convert:start",
  CONVERT_PAUSE: "convert:pause",
  CONVERT_RESUME: "convert:resume",
  CONVERT_CANCEL: "convert:cancel",
  CONVERT_RETRY: "convert:retry",
  // 转换事件（主→渲染）
  CONVERT_PROGRESS: "convert:progress",
  CONVERT_STATUS: "convert:status",
  CONVERT_LOG: "convert:log",
  CONVERT_COMPLETE: "convert:complete",
  // GPU & FFmpeg
  GPU_INFO: "gpu:info",
  FFMPEG_CHECK: "ffmpeg:check",
  // 设置
  SETTINGS_LOAD: "settings:load",
  SETTINGS_SAVE: "settings:save",
  // 最近目录
  RECENT_DIRS: "recent:dirs",
  // 窗口控制
  WINDOW_MINIMIZE: "window:minimize",
  WINDOW_MAXIMIZE: "window:maximize",
  WINDOW_CLOSE: "window:close"
};
const SUPPORTED_FORMATS = [".ts", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg", ".3gp", ".m2ts", ".mts"];
function isSupportedVideoFile(file) {
  const ext = path.extname(file).toLowerCase();
  return SUPPORTED_FORMATS.includes(ext);
}
function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
function scanDirectory(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  try {
    const files = fs.readdirSync(dir);
    const videoFiles = [];
    for (const file of files) {
      if (!isSupportedVideoFile(file)) continue;
      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;
        videoFiles.push({
          name: path.basename(file, path.extname(file)),
          path: filePath,
          ext: path.extname(file).toLowerCase(),
          size: stat.size,
          sizeFormatted: formatFileSize(stat.size)
        });
      } catch {
      }
    }
    return videoFiles;
  } catch {
    return [];
  }
}
function getOutputPath(inputPath, outputDir) {
  const ext = path.extname(inputPath);
  const baseName = path.basename(inputPath, ext);
  const dir = outputDir || path.dirname(inputPath);
  return path.join(dir, `${baseName}.mp4`);
}
function detectVideoCodec(filePath) {
  return new Promise((resolve) => {
    const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    child_process.exec(cmd, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) {
        resolve("unknown");
      } else {
        resolve(stdout.trim() || "unknown");
      }
    });
  });
}
function getVideoDuration(filePath) {
  return new Promise((resolve) => {
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    child_process.exec(cmd, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (!error && stdout.trim()) {
        const duration = parseFloat(stdout.trim());
        if (!isNaN(duration) && duration > 0) {
          resolve(duration);
          return;
        }
      }
      const cmd2 = `ffprobe -v error -show_entries stream=duration -of default=noprint_wrappers=1:nokey=1 -select_streams v:0 "${filePath}"`;
      child_process.exec(cmd2, { maxBuffer: 1024 * 1024 }, (error2, stdout2) => {
        if (!error2 && stdout2.trim()) {
          const duration = parseFloat(stdout2.trim());
          if (!isNaN(duration) && duration > 0) {
            resolve(duration);
            return;
          }
        }
        resolve(0);
      });
    });
  });
}
async function getVideoInfo(filePath) {
  const [codec, duration] = await Promise.all([
    detectVideoCodec(filePath),
    getVideoDuration(filePath)
  ]);
  return { codec, duration };
}
function buildFFmpegArgs(options) {
  const { inputPath, outputPath, codec, settings } = options;
  const args = [];
  if (settings.cudaEnabled) {
    args.push("-hwaccel", "cuda");
    const decoderMap = {
      h264: "h264_cuvid",
      hevc: "hevc_cuvid",
      h265: "hevc_cuvid",
      mpeg2video: "mpeg2_cuvid",
      mpeg4: "mpeg4_cuvid",
      vp9: "vp9_cuvid"
    };
    const decoder = decoderMap[codec];
    if (decoder) {
      args.push("-c:v", decoder);
    }
  }
  args.push("-i", inputPath);
  args.push("-c:v", settings.encoder);
  if (settings.encoder.includes("nvenc")) {
    args.push("-preset", settings.preset);
    args.push("-tune", "hq");
    args.push("-rc", "vbr");
    args.push("-cq", String(settings.quality));
    args.push("-b:v", settings.maxBitrate || "0");
    args.push("-bufsize", "16M");
    args.push("-profile:v", settings.profile);
    args.push("-level", settings.level);
  } else {
    args.push("-preset", settings.preset);
    args.push("-crf", String(settings.quality));
    if (settings.profile) {
      args.push("-profile:v", settings.profile);
    }
  }
  args.push("-pix_fmt", "yuv420p");
  args.push("-movflags", "+faststart");
  if (settings.audioCopy) {
    args.push("-c:a", "copy");
  } else {
    args.push("-c:a", "aac", "-b:a", "192k");
  }
  args.push("-c:s", "copy");
  args.push("-y", outputPath);
  return args;
}
function extractDurationFromStderr(stderr) {
  const durMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
  if (durMatch) {
    const h = parseFloat(durMatch[1]);
    const m = parseFloat(durMatch[2]);
    const s = parseFloat(durMatch[3]);
    return h * 3600 + m * 60 + s;
  }
  return 0;
}
function parseProgress(stderr, duration) {
  const timeMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
  if (!timeMatch) return null;
  const hours = parseFloat(timeMatch[1]);
  const minutes = parseFloat(timeMatch[2]);
  const seconds = parseFloat(timeMatch[3]);
  const currentTime = hours * 3600 + minutes * 60 + seconds;
  const speedMatch = stderr.match(/speed=\s*([\d.]+)\w+/);
  const bitrateMatch = stderr.match(/bitrate=\s*([\d.]+\w+\/s)/);
  const frameMatch = stderr.match(/frame=\s*(\d+)/);
  const fpsMatch = stderr.match(/fps=\s*([\d.]+)/);
  const effectiveDuration = duration > 0 ? duration : extractDurationFromStderr(stderr);
  const percent = effectiveDuration > 0 ? Math.min(currentTime / effectiveDuration * 100, 99.9) : 0;
  return {
    percent: Math.round(percent * 10) / 10,
    speed: speedMatch ? speedMatch[1] : "0",
    currentTime: `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`,
    bitrate: bitrateMatch ? bitrateMatch[1] : "0kbits/s",
    frame: frameMatch ? parseInt(frameMatch[1]) : 0,
    fps: fpsMatch ? parseFloat(fpsMatch[1]) : 0
  };
}
function runFFmpeg(options) {
  const args = buildFFmpegArgs(options);
  const proc = child_process.spawn("ffmpeg", args, {
    stdio: ["pipe", "pipe", "pipe"]
  });
  let stderrBuffer = "";
  let firstProgressLogged = false;
  proc.stderr.on("data", (data) => {
    stderrBuffer += data.toString();
    const lines = stderrBuffer.split("\r");
    const lastLine = lines[lines.length - 1];
    if (options.onProgress) {
      const progress = parseProgress(lastLine, options.duration);
      if (progress) {
        if (!firstProgressLogged) {
          firstProgressLogged = true;
          console.log(`[FFmpeg] First progress: percent=${progress.percent}%, duration=${options.duration}, currentTime=${progress.currentTime}, speed=${progress.speed}`);
        }
        options.onProgress(progress);
      }
    }
    if (options.onLog) {
      const text = data.toString();
      if (text.includes("frame=") || text.includes("error") || text.includes("Error")) {
        options.onLog(text.trim());
      }
    }
    if (stderrBuffer.length > 1e4) {
      stderrBuffer = stderrBuffer.slice(-5e3);
    }
  });
  const promise = new Promise((resolve, reject) => {
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    proc.on("error", (err) => {
      reject(new Error(`FFmpeg process error: ${err.message}`));
    });
  });
  return { promise, process: proc };
}
function debugLog$1(msg) {
  console.log(`[Converter] ${msg}`);
}
class Converter {
  constructor() {
    this.tasks = /* @__PURE__ */ new Map();
    this.queue = [];
    this.activeCount = 0;
    this.mainWindow = null;
    this.isPaused = false;
    this.logThrottleMap = /* @__PURE__ */ new Map();
    this.progressThrottleMap = /* @__PURE__ */ new Map();
    this.options = {
      concurrency: 3,
      deleteOriginal: true,
      outputDir: "",
      settings: {
        encoder: "h264_nvenc",
        preset: "p4",
        quality: 23,
        maxBitrate: "0",
        profile: "high",
        level: "5.1",
        audioCopy: true,
        cudaEnabled: true
      }
    };
  }
  setMainWindow(win) {
    this.mainWindow = win;
  }
  updateOptions(options) {
    this.options = { ...this.options, ...options };
  }
  send(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
  throttledSend(channel, taskId, data, interval) {
    const throttleMap = channel === IPC_CHANNELS.CONVERT_PROGRESS ? this.progressThrottleMap : this.logThrottleMap;
    const now = Date.now();
    const last = throttleMap.get(taskId) || 0;
    if (now - last >= interval) {
      throttleMap.set(taskId, now);
      this.send(channel, data);
    }
  }
  async startConversion(files, options) {
    this.updateOptions(options);
    this.tasks.clear();
    this.queue = [];
    this.activeCount = 0;
    this.isPaused = false;
    for (const filePath of files) {
      const outputPath = getOutputPath(filePath, this.options.outputDir || void 0);
      const fileName = path.basename(filePath);
      const task = {
        id: filePath,
        inputPath: filePath,
        outputPath,
        fileName,
        status: "waiting",
        progress: 0,
        speed: "",
        currentTime: "",
        codec: "",
        duration: 0,
        process: null
      };
      this.tasks.set(filePath, task);
      this.queue.push(filePath);
      this.send(IPC_CHANNELS.CONVERT_STATUS, {
        id: task.id,
        fileName: task.fileName,
        status: task.status,
        progress: 0,
        codec: ""
      });
    }
    this.processQueue();
  }
  async processQueue() {
    while (this.queue.length > 0 && this.activeCount < this.options.concurrency) {
      if (this.isPaused) break;
      const filePath = this.queue.shift();
      const task = this.tasks.get(filePath);
      if (!task || task.status === "cancelled") continue;
      this.activeCount++;
      this.processTask(task).finally(() => {
        this.activeCount--;
        this.processQueue();
      });
    }
    if (this.activeCount === 0 && this.queue.length === 0 && this.tasks.size > 0) {
      const results = Array.from(this.tasks.values());
      const successCount = results.filter((t) => t.status === "success").length;
      const failedCount = results.filter((t) => t.status === "failed").length;
      debugLog$1(`All tasks complete: success=${successCount}, failed=${failedCount}`);
      this.send(IPC_CHANNELS.CONVERT_COMPLETE, {
        success: successCount,
        failed: failedCount
      });
    }
  }
  async processTask(task) {
    try {
      const info = await getVideoInfo(task.inputPath);
      task.codec = info.codec;
      task.duration = info.duration;
      debugLog$1(`Task ${task.fileName}: codec=${info.codec}, duration=${info.duration}`);
      task.status = "converting";
      debugLog$1(`Task ${task.fileName}: starting conversion`);
      this.send(IPC_CHANNELS.CONVERT_STATUS, {
        id: task.id,
        fileName: task.fileName,
        status: task.status,
        progress: 0,
        codec: task.codec,
        duration: task.duration
      });
      const { promise, process: proc } = runFFmpeg({
        inputPath: task.inputPath,
        outputPath: task.outputPath,
        codec: task.codec,
        duration: task.duration,
        settings: this.options.settings,
        onProgress: (progress) => {
          task.progress = progress.percent;
          task.speed = progress.speed;
          task.currentTime = progress.currentTime;
          this.throttledSend(IPC_CHANNELS.CONVERT_PROGRESS, task.id, {
            id: task.id,
            percent: progress.percent,
            speed: progress.speed,
            currentTime: progress.currentTime,
            bitrate: progress.bitrate
          }, 200);
        },
        onLog: (log) => {
          this.throttledSend(IPC_CHANNELS.CONVERT_LOG, task.id, {
            taskId: task.id,
            level: log.toLowerCase().includes("error") ? "error" : "info",
            message: log,
            timestamp: Date.now()
          }, 500);
        }
      });
      task.process = proc;
      await promise;
      task.status = "success";
      task.progress = 100;
      debugLog$1(`Task ${task.fileName}: conversion successful`);
      if (this.options.deleteOriginal) {
        try {
          fs.unlinkSync(task.inputPath);
        } catch {
        }
      }
      this.send(IPC_CHANNELS.CONVERT_PROGRESS, {
        id: task.id,
        percent: 100,
        speed: "",
        currentTime: "",
        bitrate: ""
      });
      this.send(IPC_CHANNELS.CONVERT_STATUS, {
        id: task.id,
        fileName: task.fileName,
        status: task.status,
        progress: 100
      });
    } catch (err) {
      task.status = "failed";
      task.error = err.message;
      try {
        if (fs.existsSync(task.outputPath)) {
          fs.unlinkSync(task.outputPath);
        }
      } catch {
      }
      this.send(IPC_CHANNELS.CONVERT_STATUS, {
        id: task.id,
        fileName: task.fileName,
        status: task.status,
        progress: task.progress,
        error: err.message
      });
      this.send(IPC_CHANNELS.CONVERT_LOG, {
        taskId: task.id,
        level: "error",
        message: `转换失败: ${err.message}`,
        timestamp: Date.now()
      });
    }
  }
  pause() {
    this.isPaused = true;
  }
  resume() {
    this.isPaused = false;
    this.processQueue();
  }
  cancel(taskId) {
    if (taskId) {
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = "cancelled";
        if (task.process) {
          task.process.kill("SIGKILL");
          task.process = null;
        }
        this.send(IPC_CHANNELS.CONVERT_STATUS, {
          id: task.id,
          fileName: task.fileName,
          status: "cancelled",
          progress: task.progress
        });
      }
      this.queue = this.queue.filter((id) => id !== taskId);
    } else {
      this.isPaused = true;
      this.queue = [];
      for (const task of this.tasks.values()) {
        if (task.status === "converting" || task.status === "waiting") {
          task.status = "cancelled";
          if (task.process) {
            task.process.kill("SIGKILL");
            task.process = null;
          }
          this.send(IPC_CHANNELS.CONVERT_STATUS, {
            id: task.id,
            fileName: task.fileName,
            status: "cancelled",
            progress: task.progress
          });
        }
      }
    }
  }
  async retryFailed() {
    const failedTasks = Array.from(this.tasks.values()).filter((t) => t.status === "failed");
    if (failedTasks.length === 0) return;
    for (const task of failedTasks) {
      task.status = "waiting";
      task.progress = 0;
      task.error = void 0;
      task.process = null;
      this.queue.push(task.id);
      this.send(IPC_CHANNELS.CONVERT_STATUS, {
        id: task.id,
        fileName: task.fileName,
        status: "waiting",
        progress: 0
      });
    }
    this.isPaused = false;
    this.processQueue();
  }
  getTaskList() {
    return Array.from(this.tasks.values());
  }
}
async function detectGPU() {
  return new Promise((resolve) => {
    child_process.exec("nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader,nounits", {
      maxBuffer: 1024 * 1024
    }, (error, stdout) => {
      if (error) {
        resolve({
          available: false,
          name: "",
          driverVersion: "",
          cudaVersion: "",
          memoryTotal: ""
        });
        return;
      }
      const lines = stdout.trim().split("\n");
      if (lines.length === 0) {
        resolve({
          available: false,
          name: "",
          driverVersion: "",
          cudaVersion: "",
          memoryTotal: ""
        });
        return;
      }
      const parts = lines[0].split(",").map((s) => s.trim());
      const name = parts[0] || "Unknown";
      const driverVersion = parts[1] || "Unknown";
      const memoryTotal = parts[2] ? `${parts[2]} MB` : "Unknown";
      child_process.exec("nvidia-smi --query-gpu=compute_cap --format=csv,noheader,nounits", {
        maxBuffer: 1024 * 1024
      }, (_, cudaStdout) => {
        const cudaVersion = cudaStdout ? cudaStdout.trim() : "Unknown";
        resolve({
          available: true,
          name,
          driverVersion,
          cudaVersion,
          memoryTotal
        });
      });
    });
  });
}
async function checkFFmpeg() {
  return new Promise((resolve) => {
    child_process.exec("ffmpeg -version", { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) {
        resolve({ available: false, path: "" });
        return;
      }
      const pathMatch = stdout.match(/ffmpeg version\s+(\S+)/);
      resolve({
        available: true,
        path: pathMatch ? pathMatch[1] : "installed"
      });
    });
  });
}
const DEFAULT_SETTINGS = {
  encoder: "h264_nvenc",
  preset: "p4",
  quality: 23,
  maxBitrate: "0",
  profile: "high",
  level: "5.1",
  audioCopy: true,
  cudaEnabled: true,
  deleteOriginal: true,
  concurrency: 3,
  outputDir: "",
  recentDirs: []
};
function getSettingsPath() {
  const userDataPath = electron.app.getPath("userData");
  return path.join(userDataPath, "settings.json");
}
function loadSettings() {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf-8");
      const saved = JSON.parse(data);
      return { ...DEFAULT_SETTINGS, ...saved };
    }
  } catch {
  }
  return { ...DEFAULT_SETTINGS };
}
function saveSettings(settings) {
  try {
    const current = loadSettings();
    const updated = { ...current, ...settings };
    const settingsPath = getSettingsPath();
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), "utf-8");
    return updated;
  } catch {
    return loadSettings();
  }
}
function addRecentDir(dir) {
  const settings = loadSettings();
  let recentDirs = settings.recentDirs.filter((d) => d !== dir);
  recentDirs.unshift(dir);
  recentDirs = recentDirs.slice(0, 5);
  saveSettings({ recentDirs });
  return recentDirs;
}
function getRecentDirs() {
  return loadSettings().recentDirs;
}
const LOG_FILE = path.join(electron.app.getPath("temp"), "video-convert-debug.log");
function debugLog(msg) {
  const line = `[${(/* @__PURE__ */ new Date()).toISOString()}] ${msg}
`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {
  }
  console.log(line.trim());
}
debugLog(`App starting, log file: ${LOG_FILE}`);
let mainWindow = null;
const converter = new Converter();
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    backgroundColor: "#0F0F1A",
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  converter.setMainWindow(mainWindow);
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function registerIpcHandlers() {
  electron.ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => mainWindow == null ? void 0 : mainWindow.minimize());
  electron.ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (mainWindow == null ? void 0 : mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow == null ? void 0 : mainWindow.maximize();
    }
  });
  electron.ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => mainWindow == null ? void 0 : mainWindow.close());
  electron.ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_DIRECTORY, async () => {
    try {
      debugLog("DIALOG_SELECT_DIRECTORY called");
      const result = await electron.dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
        title: "选择视频目录"
      });
      if (result.canceled || result.filePaths.length === 0) {
        debugLog("Dialog canceled");
        return null;
      }
      const dir = result.filePaths[0];
      debugLog(`Selected dir: ${dir}`);
      addRecentDir(dir);
      return dir;
    } catch (e) {
      debugLog(`DIALOG_SELECT_DIRECTORY error: ${(e == null ? void 0 : e.message) || e}`);
      throw new Error(`选择目录失败: ${(e == null ? void 0 : e.message) || e}`);
    }
  });
  electron.ipcMain.handle(IPC_CHANNELS.SCAN_DIRECTORY, async (_, dir) => {
    try {
      debugLog(`SCAN_DIRECTORY called with: ${dir}`);
      addRecentDir(dir);
      const result = scanDirectory(dir);
      debugLog(`Scan result: ${JSON.stringify(result).substring(0, 500)}`);
      return result;
    } catch (e) {
      debugLog(`SCAN_DIRECTORY error: ${(e == null ? void 0 : e.message) || e}`);
      throw new Error(`扫描目录失败: ${(e == null ? void 0 : e.message) || e}`);
    }
  });
  electron.ipcMain.handle(IPC_CHANNELS.CONVERT_START, (_, files, settings) => {
    return converter.startConversion(files, settings);
  });
  electron.ipcMain.handle(IPC_CHANNELS.CONVERT_PAUSE, () => converter.pause());
  electron.ipcMain.handle(IPC_CHANNELS.CONVERT_RESUME, () => converter.resume());
  electron.ipcMain.handle(IPC_CHANNELS.CONVERT_CANCEL, (_, taskId) => converter.cancel(taskId));
  electron.ipcMain.handle(IPC_CHANNELS.CONVERT_RETRY, () => converter.retryFailed());
  electron.ipcMain.handle(IPC_CHANNELS.GPU_INFO, async () => {
    try {
      debugLog("GPU_INFO called");
      const result = await detectGPU();
      debugLog(`GPU result: available=${result.available}`);
      return result;
    } catch (e) {
      debugLog(`GPU_INFO error: ${(e == null ? void 0 : e.message) || e}`);
      return { available: false, name: "", driverVersion: "", cudaVersion: "", memoryTotal: "" };
    }
  });
  electron.ipcMain.handle(IPC_CHANNELS.FFMPEG_CHECK, async () => {
    try {
      debugLog("FFMPEG_CHECK called");
      const result = await checkFFmpeg();
      debugLog(`FFmpeg result: available=${result.available}`);
      return result;
    } catch (e) {
      debugLog(`FFMPEG_CHECK error: ${(e == null ? void 0 : e.message) || e}`);
      return { available: false, path: "" };
    }
  });
  electron.ipcMain.handle(IPC_CHANNELS.SETTINGS_LOAD, () => loadSettings());
  electron.ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, (_, settings) => saveSettings(settings));
  electron.ipcMain.handle(IPC_CHANNELS.RECENT_DIRS, () => getRecentDirs());
}
electron.app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
