<script setup lang="ts">
import {computed} from 'vue';
import type {TaskStatus, VideoFile} from '../types';
import {Ban, CheckCircle2, Clock, FileVideo, Loader2, XCircle,} from 'lucide-vue-next';

const props = defineProps<{
  file: VideoFile
  status?: TaskStatus
  progress?: number
  speed?: string
  error?: string
}>();

const emit = defineEmits<{
  toggle: [path: string]
}>();

const statusConfig = computed(() => {
  const map: Record<TaskStatus, { icon: any; color: string; label: string }> = {
    waiting: {icon: Clock, color: 'text-slate-400', label: '等待中'},
    converting: {icon: Loader2, color: 'text-blue-400', label: '转换中'},
    success: {icon: CheckCircle2, color: 'text-emerald-400', label: '成功'},
    failed: {icon: XCircle, color: 'text-red-400', label: '失败'},
    cancelled: {icon: Ban, color: 'text-slate-500', label: '已取消'},
  };
  return map[props.status || 'waiting'];
});

const progressPercent = computed(() => props.progress || 0);

const formatExt = (ext: string) => ext.replace('.', '').toUpperCase();
</script>

<template>
  <div
      class="glass-panel glass-panel-hover p-3 flex items-center gap-3 transition-all duration-200 animate-fade-in"
      :class="{ 'ring-1 ring-primary/30': file.selected && !status }"
      @click="!status && emit('toggle', file.path)"
  >
    <!-- 勾选框 -->
    <div v-if="!status" class="flex-shrink-0">
      <div
          class="w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center"
          :class="file.selected
          ? 'bg-primary border-primary'
          : 'border-slate-500 hover:border-slate-400'"
      >
        <svg v-if="file.selected" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    </div>

    <!-- 文件图标 -->
    <div
        class="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
      <FileVideo :size="18" class="text-primary-lighter"/>
    </div>

    <!-- 文件信息 -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="text-sm text-slate-200 truncate">{{ file.name }}</span>
        <span class="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/15 text-purple-300">
          {{ formatExt(file.ext) }}
        </span>
      </div>
      <div class="flex items-center gap-3 mt-1">
        <span class="text-xs text-slate-500">{{ file.sizeFormatted }}</span>
        <span v-if="file.codec" class="text-xs text-slate-500">{{ file.codec }}</span>
      </div>

      <!-- 进度条 -->
      <div v-if="status === 'converting'" class="mt-2">
        <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
              class="h-full progress-bar-flow rounded-full transition-all duration-300"
              :style="{ width: `${progressPercent}%` }"
          />
        </div>
        <div class="flex items-center justify-between mt-1">
          <span class="text-[11px] text-blue-400">{{ progressPercent }}%</span>
          <span v-if="speed" class="text-[11px] text-slate-500">{{ speed }}</span>
        </div>
      </div>

      <!-- 错误信息 -->
      <div v-if="error" class="mt-1">
        <span class="text-[11px] text-red-400 truncate block">{{ error }}</span>
      </div>
    </div>

    <!-- 状态图标 -->
    <div v-if="status" class="flex-shrink-0 flex items-center gap-1.5">
      <component
          :is="statusConfig.icon"
          :size="16"
          :class="[statusConfig.color, status === 'converting' ? 'animate-spin' : '']"
      />
      <span class="text-xs" :class="statusConfig.color">{{ statusConfig.label }}</span>
    </div>
  </div>
</template>
