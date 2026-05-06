<script setup lang="ts">
import {computed} from 'vue';
import {useFilesStore} from '@/stores/files';
import {useConvertStore} from '@/stores/convert';
import {ArrowRightLeft, CheckSquare, Search, Square} from 'lucide-vue-next';
import FileCard from './FileCard.vue';

const filesStore = useFilesStore();
const convertStore = useConvertStore();

const hasFiles = computed(() => filesStore.files.length > 0);
const isConverting = computed(() => convertStore.isConverting);

function formatTotalSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getTaskForFile(path: string) {
  const task = convertStore.taskList.find((t) => t.id === path);
  if (!task) return {};
  return {
    status: task.status,
    progress: task.progress,
    speed: task.speed,
    error: task.error,
  };
}
</script>

<template>
  <div class="glass-panel flex flex-col overflow-hidden" style="height: 100%">
    <!-- 工具栏 -->
    <div class="flex items-center gap-2 p-3 border-b border-white/5">
      <div class="relative flex-1">
        <Search :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"/>
        <input
            v-model="filesStore.searchQuery"
            type="text"
            placeholder="搜索文件..."
            class="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-primary/30 transition-colors"
        />
      </div>

      <select
          v-model="filesStore.filterExt"
          class="px-2 py-1.5 bg-white/5 border border-white/5 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary/30 appearance-none cursor-pointer"
      >
        <option value="">全部格式</option>
        <option v-for="ext in filesStore.extensions" :key="ext" :value="ext">
          {{ ext.replace('.', '').toUpperCase() }}
        </option>
      </select>

      <div class="flex items-center gap-1">
        <button
            class="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            title="全选"
            :disabled="isConverting"
            @click="filesStore.selectAll()"
        >
          <CheckSquare :size="14"/>
        </button>
        <button
            class="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            title="取消全选"
            :disabled="isConverting"
            @click="filesStore.deselectAll()"
        >
          <Square :size="14"/>
        </button>
        <button
            class="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            title="反选"
            :disabled="isConverting"
            @click="filesStore.invertSelection()"
        >
          <ArrowRightLeft :size="14"/>
        </button>
      </div>
    </div>

    <!-- 文件列表 -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
      <div v-if="!hasFiles" class="flex flex-col items-center justify-center h-full text-slate-500">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"
             stroke-linecap="round" stroke-linejoin="round" class="mb-3 opacity-40">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <p class="text-sm">选择目录以扫描视频文件</p>
        <p class="text-xs mt-1 text-slate-600">支持 TS, MKV, AVI, MOV, WMV 等格式</p>
      </div>

      <template v-else>
        <FileCard
            v-for="file in filesStore.filteredFiles"
            :key="file.path"
            :file="file"
            v-bind="getTaskForFile(file.path)"
            @toggle="filesStore.toggleFile"
        />
      </template>
    </div>

    <!-- 底部统计 -->
    <div v-if="hasFiles"
         class="flex items-center justify-between px-3 py-2 border-t border-white/5 text-xs text-slate-500">
      <span>共 {{ filesStore.totalCount }} 个文件</span>
      <span>已选 {{ filesStore.selectedCount }} 个 · {{ formatTotalSize(filesStore.totalSize) }}</span>
    </div>
  </div>
</template>
