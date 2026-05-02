<script setup lang="ts">
import { computed } from 'vue'
import { useConvertStore } from '../stores/convert'
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-vue-next'

const convertStore = useConvertStore()

const totalProgress = computed(() => convertStore.totalProgress)
const hasTasks = computed(() => convertStore.totalCount > 0)
</script>

<template>
  <div v-if="hasTasks" class="glass-panel p-4 animate-slide-up">
    <!-- 总体进度条 -->
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm text-slate-300 font-medium">转换进度</span>
      <span class="text-sm text-primary-lighter font-mono">{{ totalProgress }}%</span>
    </div>
    <div class="h-2 bg-white/5 rounded-full overflow-hidden mb-3">
      <div
        class="h-full progress-bar-flow rounded-full transition-all duration-500"
        :style="{ width: `${totalProgress}%` }"
      />
    </div>

    <!-- 统计数字 -->
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-1.5">
        <CheckCircle2 :size="14" class="text-emerald-400" />
        <span class="text-xs text-slate-400">成功</span>
        <span class="text-xs text-emerald-400 font-medium">{{ convertStore.successCount }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <XCircle :size="14" class="text-red-400" />
        <span class="text-xs text-slate-400">失败</span>
        <span class="text-xs text-red-400 font-medium">{{ convertStore.failedCount }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <Loader2 :size="14" class="text-blue-400 animate-spin" />
        <span class="text-xs text-slate-400">转换中</span>
        <span class="text-xs text-blue-400 font-medium">{{ convertStore.convertingCount }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <Clock :size="14" class="text-slate-500" />
        <span class="text-xs text-slate-400">等待中</span>
        <span class="text-xs text-slate-500 font-medium">{{ convertStore.waitingCount }}</span>
      </div>
      <div class="ml-auto text-xs text-slate-500">
        {{ convertStore.completedCount }} / {{ convertStore.totalCount }}
      </div>
    </div>
  </div>
</template>
