<script setup lang="ts">
import { computed } from 'vue'
import { Play, Pause, Square, RotateCcw, Settings } from 'lucide-vue-next'
import { useFilesStore } from '../stores/files'
import { useConvertStore } from '../stores/convert'
import { useSettingsStore } from '../stores/settings'

const emit = defineEmits<{
  start: []
  pause: []
  resume: []
  cancel: []
  retry: []
  openSettings: []
}>()

const filesStore = useFilesStore()
const convertStore = useConvertStore()
const settingsStore = useSettingsStore()

const canStart = computed(() => filesStore.selectedCount > 0 && !convertStore.isConverting)
const isConverting = computed(() => convertStore.isConverting)
const isPaused = computed(() => convertStore.isPaused)
const hasFailed = computed(() => convertStore.failedCount > 0)
</script>

<template>
  <div class="glass-panel p-3 flex items-center gap-2">
    <!-- 开始/暂停按钮 -->
    <button
      v-if="!isConverting"
      class="btn-glow flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-primary to-primary-light text-white rounded-lg font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      :disabled="!canStart"
      @click="emit('start')"
    >
      <Play :size="16" />
      开始转换
      <span v-if="filesStore.selectedCount > 0" class="text-xs opacity-70">({{ filesStore.selectedCount }})</span>
    </button>

    <template v-else>
      <button
        v-if="!isPaused"
        class="btn-glow flex items-center gap-2 px-4 py-2 bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 rounded-lg font-medium text-sm hover:bg-yellow-500/20 transition-colors"
        @click="emit('pause')"
      >
        <Pause :size="16" />
        暂停
      </button>
      <button
        v-else
        class="btn-glow flex items-center gap-2 px-4 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-lg font-medium text-sm hover:bg-emerald-500/20 transition-colors"
        @click="emit('resume')"
      >
        <Play :size="16" />
        继续
      </button>

      <button
        class="btn-glow flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg font-medium text-sm hover:bg-red-500/15 transition-colors"
        @click="emit('cancel')"
      >
        <Square :size="14" />
        取消
      </button>
    </template>

    <!-- 重试失败 -->
    <button
      v-if="hasFailed && !isConverting"
      class="btn-glow flex items-center gap-2 px-4 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg font-medium text-sm hover:bg-orange-500/15 transition-colors"
      @click="emit('retry')"
    >
      <RotateCcw :size="14" />
      重试失败
    </button>

    <!-- 右侧 -->
    <div class="ml-auto flex items-center gap-3">
      <div class="flex items-center gap-2 text-xs text-slate-500">
        <span>并发数:</span>
        <div class="flex items-center gap-1">
          <button
            class="w-6 h-6 rounded bg-white/5 text-slate-400 hover:bg-white/10 flex items-center justify-center transition-colors"
            :disabled="settingsStore.settings.concurrency <= 1"
            @click="settingsStore.updateSettings({ concurrency: settingsStore.settings.concurrency - 1 })"
          >
            -
          </button>
          <span class="w-6 text-center text-slate-300 font-mono">{{ settingsStore.settings.concurrency }}</span>
          <button
            class="w-6 h-6 rounded bg-white/5 text-slate-400 hover:bg-white/10 flex items-center justify-center transition-colors"
            :disabled="settingsStore.settings.concurrency >= 6"
            @click="settingsStore.updateSettings({ concurrency: settingsStore.settings.concurrency + 1 })"
          >
            +
          </button>
        </div>
      </div>

      <button
        class="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
        @click="emit('openSettings')"
      >
        <Settings :size="18" />
      </button>
    </div>
  </div>
</template>
