/// <reference types="vite/client" />

declare module '*.vue' {
    import type {DefineComponent} from 'vue';
    const component: DefineComponent<{}, {}, any>;
    export default component;
}

interface Window {
    electronAPI: {
        selectDirectory: () => Promise<string | null>
        scanDirectory: (dir: string) => Promise<import('./types').VideoFile[]>
        startConvert: (files: string[], settings: import('./types').ConvertSettings) => Promise<void>
        pauseConvert: () => Promise<void>
        resumeConvert: () => Promise<void>
        cancelConvert: (taskId?: string) => Promise<void>
        retryFailed: () => Promise<void>
        getGPUInfo: () => Promise<import('./types').GPUInfo>
        checkFFmpeg: () => Promise<{ available: boolean; path: string }>
        loadSettings: () => Promise<import('./types').ConvertSettings>
        saveSettings: (settings: import('./types').ConvertSettings) => Promise<void>
        getRecentDirs: () => Promise<string[]>
        windowMinimize: () => Promise<void>
        windowMaximize: () => Promise<void>
        windowClose: () => Promise<void>
        onConvertProgress: (callback: (data: import('./types').ProgressData) => void) => () => void
        onConvertStatus: (callback: (data: import('./types').StatusData) => void) => () => void
        onConvertLog: (callback: (data: import('./types').LogEntry) => void) => () => void
        onConvertComplete: (callback: (data: { success: number; failed: number }) => void) => () => void
    };
}
