// 视频文件信息
export interface VideoFile {
    name: string;
    path: string;
    ext: string;
    size: number;
    sizeFormatted: string;
    codec?: string;
    duration?: number;
    selected?: boolean;
    outputExists?: boolean;
}

// 转换任务状态
export type TaskStatus = 'waiting' | 'converting' | 'success' | 'failed' | 'cancelled'

// 转换任务
export interface ConvertTask {
    id: string;
    fileName: string;
    inputPath: string;
    outputPath: string;
    status: TaskStatus;
    progress: number;
    speed: string;
    currentTime: string;
    codec: string;
    duration: number;
    error?: string;
}

// 进度数据
export interface ProgressData {
    id: string;
    percent: number;
    speed: string;
    currentTime: string;
    bitrate: string;
}

// 状态数据
export interface StatusData {
    id: string;
    fileName: string;
    status: TaskStatus;
    progress: number;
    codec?: string;
    duration?: number;
    error?: string;
}

// 日志条目
export interface LogEntry {
    taskId: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    timestamp: number;
}

// GPU 信息
export interface GPUInfo {
    available: boolean;
    name: string;
    driverVersion: string;
    cudaVersion: string;
    memoryTotal: string;
}

// 转换设置
export interface ConvertSettings {
    encoder: string;
    preset: string;
    quality: number;
    maxBitrate: string;
    profile: string;
    level: string;
    audioCopy: boolean;
    cudaEnabled: boolean;
    deleteOriginal: boolean;
    concurrency: number;
    outputDir: string;
}

// 预设方案
export interface Preset {
    name: string;
    label: string;
    description: string;
    settings: Partial<ConvertSettings>;
}

// 完成统计
export interface CompleteStats {
    success: number;
    failed: number;
}
