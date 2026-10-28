<script lang="ts" setup>
import {computed} from 'vue';
import {ChevronRight, Minus, Pause, Play, Plus, RotateCcw, Settings, Square} from 'lucide-vue-next';
import {useFilesStore} from '@/stores/files';
import {useConvertStore} from '@/stores/convert';
import {useSettingsStore} from '@/stores/settings';

const emit = defineEmits<{
  start: []
  pause: []
  resume: []
  cancel: []
  retry: []
  openSettings: []
}>();

const filesStore = useFilesStore();
const convertStore = useConvertStore();
const settingsStore = useSettingsStore();

const canStart = computed(() => filesStore.selectedCount > 0 && !convertStore.isConverting);
const isConverting = computed(() => convertStore.isConverting);
const isPaused = computed(() => convertStore.isPaused);
const hasFailed = computed(() => convertStore.failedCount > 0);
const encoderLabel = computed(() => settingsStore.settings.encoder.includes('265') || settingsStore.settings.encoder.includes('hevc') ? 'H.265' : 'H.264');
</script>

<template>
  <div class="glass-panel px-4 py-3 flex items-center gap-3">
    <!-- 开始/暂停按钮 -->
    <button
        v-if="!isConverting"
        :disabled="!canStart"
        class="ui-button ui-button-primary min-w-[132px]"
        @click="emit('start')"
    >
      <Play :size="16"/>
      开始转换
      <span v-if="filesStore.selectedCount > 0" class="text-xs opacity-70">({{ filesStore.selectedCount }})</span>
    </button>

    <template v-else>
      <button
          v-if="!isPaused"
          class="btn-glow flex items-center gap-2 px-4 py-2 bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 rounded-lg font-medium text-sm hover:bg-yellow-500/20 transition-colors"
          @click="emit('pause')"
      >
        <Pause :size="16"/>
        暂停
      </button>
      <button
          v-else
          class="btn-glow flex items-center gap-2 px-4 py-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-lg font-medium text-sm hover:bg-emerald-500/20 transition-colors"
          @click="emit('resume')"
      >
        <Play :size="16"/>
        继续
      </button>

      <button
          class="btn-glow flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg font-medium text-sm hover:bg-red-500/15 transition-colors"
          @click="emit('cancel')"
      >
        <Square :size="14"/>
        取消
      </button>
    </template>

    <!-- 重试失败 -->
    <button
        v-if="hasFailed && !isConverting"
        class="btn-glow flex items-center gap-2 px-4 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg font-medium text-sm hover:bg-orange-500/15 transition-colors"
        @click="emit('retry')"
    >
      <RotateCcw :size="14"/>
      重试失败
    </button>

    <!-- 右侧 -->
    <div class="control-summary flex items-center gap-2 text-[11px] text-slate-400">
      <span>{{ encoderLabel }}</span><ChevronRight :size="12" class="text-slate-600"/><span class="text-slate-300">MP4</span>
      <span class="mx-1 text-slate-600">·</span>
      <span v-if="filesStore.selectedCount">已选择 {{ filesStore.selectedCount }} 个文件</span>
      <span v-else>选择文件后开始转换</span>
    </div>
    <div class="ml-auto flex items-center gap-3">
      <div class="flex items-center gap-2 text-[11px] text-slate-400">
        <span>并行任务</span>
        <div class="flex items-center gap-0.5 rounded-lg border border-white/5 bg-black/10 p-0.5">
          <button
              :disabled="settingsStore.settings.concurrency <= 1"
              class="icon-button !h-6 !w-6"
              aria-label="减少并行任务"
              @click="settingsStore.updateSettings({ concurrency: settingsStore.settings.concurrency - 1 })"
          >
            <Minus :size="12"/>
          </button>
          <span class="w-6 text-center text-slate-300 font-mono">{{ settingsStore.settings.concurrency }}</span>
          <button
              :disabled="settingsStore.settings.concurrency >= 6"
              class="icon-button !h-6 !w-6"
              aria-label="增加并行任务"
              @click="settingsStore.updateSettings({ concurrency: settingsStore.settings.concurrency + 1 })"
          >
            <Plus :size="12"/>
          </button>
        </div>
      </div>

      <button
          class="ui-button"
          @click="emit('openSettings')"
      >
        <Settings :size="14"/>
        转换设置
      </button>
    </div>
  </div>
</template>
