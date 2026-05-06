<script setup lang="ts">
import {onMounted, onUnmounted, ref, toRaw} from 'vue';
import {useFilesStore} from '../stores/files';
import {useConvertStore} from '../stores/convert';
import {useSettingsStore} from '../stores/settings';
import {useElectron} from '../composables/useElectron';
import DirSelector from '../components/DirSelector.vue';
import FileList from '../components/FileList.vue';
import GlobalProgress from '../components/GlobalProgress.vue';
import ControlBar from '../components/ControlBar.vue';
import LogPanel from '../components/LogPanel.vue';
import SettingsPanel from '../components/SettingsPanel.vue';

const filesStore = useFilesStore();
const convertStore = useConvertStore();
const settingsStore = useSettingsStore();
const electron = useElectron();

const showSettings = ref(false);
const isDragOver = ref(false);

// 注册 IPC 事件
onMounted(async () => {
  try {
    // 检测环境
    const gpuInfo = await electron.getGPUInfo();
    settingsStore.setGPUInfo(gpuInfo);

    const ffmpegStatus = await electron.checkFFmpeg();
    settingsStore.setFFmpegStatus(ffmpegStatus.available, ffmpegStatus.path);

    // 加载设置
    const savedSettings = await electron.loadSettings();
    if (savedSettings) {
      settingsStore.updateSettings(savedSettings);
    }
  } catch (e) {
    console.error('初始化失败:', e);
  }

  // 监听转换事件
  electron.onConvertProgress((data) => {
    convertStore.updateTaskProgress(data);
  });

  electron.onConvertStatus((data) => {
    convertStore.updateTaskStatus(data);
  });

  electron.onConvertLog((data) => {
    convertStore.addLog(data);
  });

  electron.onConvertComplete((data) => {
    convertStore.isConverting = false;
    convertStore.isPaused = false;
    // 确保所有任务最终状态同步
    convertStore.taskList.forEach((t) => {
      if (t.status === 'converting' || t.status === 'waiting') {
        t.status = 'success';
        t.progress = 100;
      }
    });
  });

  // 拖拽事件
  document.addEventListener('dragover', handleDragOver);
  document.addEventListener('dragleave', handleDragLeave);
  document.addEventListener('drop', handleDrop);
});

onUnmounted(() => {
  document.removeEventListener('dragover', handleDragOver);
  document.removeEventListener('dragleave', handleDragLeave);
  document.removeEventListener('drop', handleDrop);
});

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = true;
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = false;
}

async function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = false;
  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const firstFile = files[0];
  // 如果拖入的是目录
  const path = firstFile.path;
  if (path) {
    filesStore.setCurrentDir(path);
    const scannedFiles = await electron.scanDirectory(path);
    filesStore.setFiles(scannedFiles);
  }
}

async function handleStart() {
  const selectedFiles = filesStore.selectedFiles.map((f) => toRaw(f).path);
  if (selectedFiles.length === 0) return;

  convertStore.isConverting = true;
  convertStore.isPaused = false;

  const rawSettings = toRaw(settingsStore.settings);
  await electron.startConvert(selectedFiles, {
    ...rawSettings,
  });

  // 保存设置
  await electron.saveSettings(rawSettings);
}

async function handlePause() {
  convertStore.isPaused = true;
  await electron.pauseConvert();
}

async function handleResume() {
  convertStore.isPaused = false;
  await electron.resumeConvert();
}

async function handleCancel() {
  await electron.cancelConvert();
  convertStore.reset();
}

async function handleRetry() {
  convertStore.isConverting = true;
  await electron.retryFailed();
}
</script>

<template>
  <div
      class="flex flex-col h-screen bg-[#0F0F1A]"
      :class="{ 'drag-highlight': isDragOver }"
  >
    <!-- 目录选择 -->
    <div class="p-4 pb-2">
      <DirSelector/>
    </div>

    <!-- 全局进度 -->
    <div class="px-4 pb-2">
      <GlobalProgress/>
    </div>

    <!-- 控制栏 -->
    <div class="px-4 pb-2">
      <ControlBar
          @start="handleStart"
          @pause="handlePause"
          @resume="handleResume"
          @cancel="handleCancel"
          @retry="handleRetry"
          @open-settings="showSettings = true"
      />
    </div>

    <!-- 文件列表 -->
    <div class="flex-1 px-4 mb-2 overflow-hidden">
      <FileList/>
    </div>

    <!-- 日志面板 -->
    <div class="px-4 pb-2">
      <LogPanel/>
    </div>

    <!-- 设置面板 -->
    <SettingsPanel v-if="showSettings" @close="showSettings = false"/>

    <!-- 拖拽覆盖层 -->
    <div
        v-if="isDragOver"
        class="fixed inset-0 z-40 bg-primary/5 border-2 border-dashed border-primary/40 flex items-center justify-center pointer-events-none"
    >
      <div class="text-center animate-pulse-glow p-8 glass-panel">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3 text-primary-lighter">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p class="text-primary-lighter font-medium">拖放视频目录到此处</p>
      </div>
    </div>
  </div>
</template>
