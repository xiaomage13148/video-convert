<script setup lang="ts">
import {ChevronDown, Clock, FolderOpen} from 'lucide-vue-next';
import {useFilesStore} from '../stores/files';
import {useElectron} from '../composables/useElectron';
import {ref} from 'vue';

const filesStore = useFilesStore();
const electron = useElectron();
const showRecent = ref(false);
const recursiveScan = ref(false);

async function selectDirectory() {
  try {
    const dir = await electron.selectDirectory();
    if (dir) {
      filesStore.setCurrentDir(dir);
      await scanDir(dir);
    }
  } catch (e: any) {
    scanError.value = e?.message || String(e);
    console.error('选择目录失败:', e);
  }
}

const scanError = ref('');

async function scanDir(dir: string) {
  filesStore.isLoading = true;
  showRecent.value = false;
  scanError.value = '';
  try {
    const scannedFiles = await electron.scanDirectory(dir, recursiveScan.value);
    filesStore.setFiles(scannedFiles);
    const dirs = await electron.getRecentDirs();
    filesStore.setRecentDirs(dirs);
  } catch (e: any) {
    scanError.value = e?.message || String(e);
    console.error('扫描目录失败:', e);
  } finally {
    filesStore.isLoading = false;
  }
}

async function toggleRecursive() {
  recursiveScan.value = !recursiveScan.value;
  if (filesStore.currentDir) {
    await scanDir(filesStore.currentDir);
  }
}

async function useRecentDir(dir: string) {
  filesStore.setCurrentDir(dir);
  await scanDir(dir);
}

async function loadRecentDirs() {
  try {
    const dirs = await electron.getRecentDirs();
    filesStore.setRecentDirs(dirs);
    showRecent.value = !showRecent.value;
  } catch (e) {
    console.error('加载最近目录失败:', e);
  }
}

loadRecentDirs();
</script>

<template>
  <div class="glass-panel p-4">
    <div class="flex items-center gap-3">
      <button
          class="btn-glow flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-primary-light text-white rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
          @click="selectDirectory"
      >
        <FolderOpen :size="16"/>
        选择目录
      </button>

      <label class="flex items-center gap-2 px-3 py-2.5 bg-white/5 rounded-lg text-sm text-slate-300 cursor-pointer hover:bg-white/8 transition-colors select-none">
        <input
            type="checkbox"
            :checked="recursiveScan"
            @change="toggleRecursive"
            class="w-4 h-4 rounded border-slate-500 text-primary focus:ring-primary/50 bg-transparent"
        />
        递归子目录
      </label>

      <div class="flex-1 relative">
        <div
            class="flex items-center gap-2 px-3 py-2.5 bg-white/5 rounded-lg text-sm text-slate-300 cursor-pointer hover:bg-white/8 transition-colors"
            @click="loadRecentDirs"
        >
          <span v-if="filesStore.currentDir" class="truncate">{{ filesStore.currentDir }}</span>
          <span v-else class="text-slate-500">未选择目录</span>
          <ChevronDown :size="14" class="ml-auto flex-shrink-0 text-slate-500"/>
        </div>

        <div
            v-if="showRecent && filesStore.recentDirs.length > 0"
            class="absolute top-full left-0 right-0 mt-1 glass-panel p-1 z-50 animate-slide-up"
        >
          <div class="px-3 py-1.5 text-xs text-slate-500 flex items-center gap-1">
            <Clock :size="12"/>
            最近使用
          </div>
          <button
              v-for="dir in filesStore.recentDirs"
              :key="dir"
              class="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 rounded-md truncate transition-colors"
              @click="useRecentDir(dir)"
          >
            {{ dir }}
          </button>
        </div>
      </div>
    </div>
    <div v-if="scanError" class="mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
      {{ scanError }}
    </div>
  </div>
</template>
