<script lang="ts" setup>
import {computed} from 'vue';
import {useFilesStore} from '@/stores/files';
import {useConvertStore} from '@/stores/convert';
import {ArrowRightLeft, CheckSquare, FileVideo, FolderOpen, ListVideo, Loader2, Search, Square} from 'lucide-vue-next';
import FileCard from '@/components/FileCard.vue';
import AppSelect from '@/components/AppSelect.vue';

const filesStore = useFilesStore();
const convertStore = useConvertStore();

const hasFiles = computed(() => filesStore.files.length > 0);
const isConverting = computed(() => convertStore.isConverting);
const formatOptions = computed(() => [
  {value: '', label: '全部格式'},
  ...filesStore.extensions.map(ext => ({value: ext, label: ext.replace('.', '').toUpperCase()})),
]);

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
    <div class="panel-heading shrink-0">
      <ListVideo :size="16" class="text-violet-300"/>
      <h2 class="panel-title">转换队列</h2>
      <span class="count-badge">{{ filesStore.totalCount }}</span>
      <span class="ml-auto text-[11px] text-slate-400">{{ hasFiles ? '勾选需要转换的文件' : '添加视频后将在此显示' }}</span>
    </div>
    <!-- 工具栏 -->
    <div class="flex shrink-0 items-center gap-2 px-4 py-2.5 border-b border-white/5">
      <div class="relative flex-1">
        <Search :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"/>
        <input
            v-model="filesStore.searchQuery"
            class="field w-full !pl-8"
            placeholder="搜索文件名称…"
            aria-label="搜索视频文件"
            type="text"
        />
      </div>

      <AppSelect id="file-format" v-model="filesStore.filterExt" :options="formatOptions" class="w-28 shrink-0" aria-label="筛选视频格式"/>

      <div class="flex items-center gap-1">
        <button
            :disabled="isConverting || !hasFiles"
            class="icon-button"
            title="全选"
            @click="filesStore.selectAll()"
        >
          <CheckSquare :size="14"/>
        </button>
        <button
            :disabled="isConverting || !hasFiles"
            class="icon-button"
            title="取消全选"
            @click="filesStore.deselectAll()"
        >
          <Square :size="14"/>
        </button>
        <button
            :disabled="isConverting || !hasFiles"
            class="icon-button"
            title="反选"
            @click="filesStore.invertSelection()"
        >
          <ArrowRightLeft :size="14"/>
        </button>
      </div>
    </div>

    <!-- 文件列表 -->
    <div class="flex-1 min-h-0 overflow-y-auto p-3 space-y-2" :aria-busy="filesStore.isLoading">
      <div v-if="filesStore.isLoading" class="flex flex-col gap-3 items-center justify-center h-full min-h-[120px] text-slate-400" role="status">
        <Loader2 :size="28" class="animate-spin text-violet-300"/><p class="text-xs">正在扫描视频文件…</p>
      </div>
      <div v-else-if="!hasFiles" class="queue-empty flex flex-col items-center justify-center h-full min-h-[150px] py-1 text-center">
        <div class="empty-symbol mb-3"><FolderOpen :size="28" :stroke-width="1.3"/></div>
        <h3 class="text-sm font-medium text-slate-200">{{ filesStore.currentDir ? '这个目录中还没有视频' : '从一个视频目录开始' }}</h3>
        <p class="text-xs mt-1.5 text-slate-400">{{ filesStore.currentDir ? '尝试包含子目录，或选择其他目录' : '点击上方「选择目录」，也可以将文件夹拖放到这里' }}</p>
        <div class="empty-format-list flex gap-1.5 mt-3"><span v-for="format in ['TS', 'MKV', 'AVI', 'MOV', 'WMV']" :key="format" class="empty-formats">{{ format }}</span></div>
      </div>
      <div v-else-if="!filesStore.filteredFiles.length" class="flex flex-col items-center justify-center gap-3 h-full min-h-[120px] text-slate-400">
        <FileVideo :size="28" :stroke-width="1.3"/>
        <p class="text-sm text-slate-300">没有找到匹配的文件</p>
        <button class="ui-button" @click="filesStore.searchQuery = ''; filesStore.filterExt = ''">清除筛选</button>
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
         class="flex shrink-0 items-center justify-between px-4 py-2.5 border-t border-white/5 text-[11px] text-slate-400">
      <span>共 {{ filesStore.totalCount }} 个文件</span>
      <span>已选 {{ filesStore.selectedCount }} 个 · {{ formatTotalSize(filesStore.totalSize) }}</span>
    </div>
  </div>
</template>
