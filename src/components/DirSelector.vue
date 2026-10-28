<script lang="ts" setup>
import {ChevronDown, Clock, FolderOpen, Loader2} from 'lucide-vue-next';
import {useFilesStore} from '@/stores/files';
import {useElectron} from '@/composables/useElectron';
import {onBeforeUnmount, onMounted, ref} from 'vue';

const filesStore = useFilesStore();
const electron = useElectron();
const showRecent = ref(false);
const recursiveScan = ref(false);
const scanError = ref('');
const recentMenu = ref<HTMLElement | null>(null);

async function selectDirectory() {
  try {
    const dir = await electron.selectDirectory();
    if (dir) {
      filesStore.setCurrentDir(dir);
      await scanDir(dir);
    }
  } catch (e: any) {
    scanError.value = e?.message || String(e);
  }
}

async function scanDir(dir: string) {
  filesStore.isLoading = true;
  showRecent.value = false;
  scanError.value = '';
  try {
    const scannedFiles = await electron.scanDirectory(dir, recursiveScan.value);
    filesStore.setFiles(scannedFiles);
    filesStore.setRecentDirs(await electron.getRecentDirs());
  } catch (e: any) {
    scanError.value = e?.message || String(e);
  } finally {
    filesStore.isLoading = false;
  }
}

async function toggleRecursive() {
  recursiveScan.value = !recursiveScan.value;
  if (filesStore.currentDir) await scanDir(filesStore.currentDir);
}

async function useRecentDir(dir: string) {
  filesStore.setCurrentDir(dir);
  await scanDir(dir);
}

async function loadRecentDirs() {
  try {
    filesStore.setRecentDirs(await electron.getRecentDirs());
    showRecent.value = !showRecent.value;
  } catch (e) {
    console.error('加载最近目录失败:', e);
  }
}

function closeRecent(e: PointerEvent) {
  if (!recentMenu.value?.contains(e.target as Node)) showRecent.value = false;
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') showRecent.value = false;
}
onMounted(() => {
  document.addEventListener('pointerdown', closeRecent);
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeRecent);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <section class="glass-panel px-4 py-3.5" aria-label="视频来源">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2.5">
        <span class="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-violet-300"><FolderOpen :size="14"/></span>
        <h1 class="panel-title">视频来源</h1>
        <span class="text-[11px] text-slate-400">选择目录，批量转换视频</span>
      </div>
      <span class="text-[10px] tracking-wider text-slate-500">本地处理 · 文件无需上传</span>
    </div>
    <div class="flex items-center gap-3">
      <button :disabled="filesStore.isLoading" class="ui-button ui-button-primary h-10 px-4" @click="selectDirectory">
        <Loader2 v-if="filesStore.isLoading" :size="16" class="animate-spin"/>
        <FolderOpen v-else :size="16"/>
        {{ filesStore.isLoading ? '正在扫描…' : '选择目录' }}
      </button>

      <div ref="recentMenu" class="flex-1 min-w-0 relative">
        <button class="field flex items-center gap-2 w-full h-10 text-left" :aria-expanded="showRecent"
                aria-controls="recent-directories" :title="filesStore.currentDir || '最近使用的目录'" @click="loadRecentDirs">
          <FolderOpen :size="14" class="shrink-0 text-slate-500"/>
          <span v-if="filesStore.currentDir" class="truncate">{{ filesStore.currentDir }}</span>
          <span v-else class="text-slate-400">选择视频所在目录，或拖放文件夹到窗口</span>
          <ChevronDown :size="14" :class="{'rotate-180': showRecent}" class="ml-auto shrink-0 text-slate-400 transition-transform"/>
        </button>
        <div v-if="showRecent" id="recent-directories"
             class="absolute top-full left-0 right-0 mt-2 rounded-xl border border-white/10 bg-[#202030] p-1.5 z-[100] shadow-xl">
          <div class="px-2.5 py-2 text-[11px] text-slate-400 flex items-center gap-1.5"><Clock :size="12"/>最近使用</div>
          <button v-for="dir in filesStore.recentDirs" :key="dir" :title="dir"
                  class="w-full text-left px-2.5 py-2 text-xs text-slate-300 hover:bg-white/5 rounded-md truncate"
                  @click="useRecentDir(dir)">{{ dir }}</button>
          <p v-if="!filesStore.recentDirs.length" class="px-2.5 py-3 text-xs text-slate-400">暂无最近使用的目录</p>
        </div>
      </div>

      <label class="flex shrink-0 items-center gap-2 text-xs text-slate-300 cursor-pointer px-1">
        <input :checked="recursiveScan" :disabled="filesStore.isLoading" class="w-3.5 h-3.5 rounded" type="checkbox" @change="toggleRecursive"/>
        包含子目录
      </label>
    </div>
    <div v-if="scanError" role="alert" class="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300">{{ scanError }}</div>
  </section>
</template>
