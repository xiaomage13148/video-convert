<script setup lang="ts">
import {computed, nextTick, ref, watch} from 'vue';
import {useConvertStore} from '../stores/convert';
import {ArrowDown, Download, Search, Trash2} from 'lucide-vue-next';

const convertStore = useConvertStore();

const searchQuery = ref('');
const levelFilter = ref<string>('');
const autoScroll = ref(true);
const logContainer = ref<HTMLElement | null>(null);

const filteredLogs = computed(() => {
  let result = convertStore.logs;
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((l) => l.message.toLowerCase().includes(query));
  }
  if (levelFilter.value) {
    result = result.filter((l) => l.level === levelFilter.value);
  }
  return result;
});

const logCount = computed(() => convertStore.logs.length);

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', {hour12: false});
}

function levelClass(level: string): string {
  switch (level) {
    case 'error':
      return 'text-red-400 bg-red-500/10';
    case 'warn':
      return 'text-yellow-400 bg-yellow-500/10';
    default:
      return 'text-blue-400 bg-blue-500/10';
  }
}

function levelLabel(level: string): string {
  switch (level) {
    case 'error':
      return 'ERROR';
    case 'warn':
      return 'WARN';
    default:
      return 'INFO';
  }
}

function scrollToBottom() {
  if (!autoScroll.value || !logContainer.value) return;
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
}

watch(() => convertStore.logs.length, () => {
  scrollToBottom();
});

async function exportLogs() {
  const content = convertStore.logs
      .map((l) => `[${formatTime(l.timestamp)}] [${levelLabel(l.level)}] ${l.message}`)
      .join('\n');

  const blob = new Blob([content], {type: 'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `convert-log-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="glass-panel flex flex-col overflow-hidden" style="height: 220px;">
    <!-- 工具栏 -->
    <div class="flex items-center gap-2 p-2 border-b border-white/5">
      <div class="relative flex-1">
        <Search :size="12" class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500"/>
        <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索日志..."
            class="w-full pl-7 pr-2 py-1 bg-white/5 border border-white/5 rounded text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-primary/30"
        />
      </div>

      <select
          v-model="levelFilter"
          class="px-2 py-1 bg-white/5 border border-white/5 rounded text-xs text-slate-300 focus:outline-none appearance-none cursor-pointer"
      >
        <option value="">全部</option>
        <option value="info">信息</option>
        <option value="warn">警告</option>
        <option value="error">错误</option>
      </select>

      <button
          class="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          title="导出日志"
          @click="exportLogs"
      >
        <Download :size="14"/>
      </button>
      <button
          class="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          title="清空日志"
          @click="convertStore.clearLogs()"
      >
        <Trash2 :size="14"/>
      </button>
      <button
          class="p-1 rounded transition-colors"
          :class="autoScroll ? 'text-primary hover:text-primary-light' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'"
          title="自动滚动"
          @click="autoScroll = !autoScroll"
      >
        <ArrowDown :size="14"/>
      </button>

      <span class="text-[11px] text-slate-600">{{ logCount }} 条</span>
    </div>

    <!-- 日志列表 -->
    <div ref="logContainer" class="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-0.5">
      <div
          v-for="(log, i) in filteredLogs"
          :key="i"
          class="flex items-start gap-2 py-0.5 px-1 rounded hover:bg-white/3 transition-colors"
      >
        <span class="text-slate-600 flex-shrink-0">{{ formatTime(log.timestamp) }}</span>
        <span
            class="px-1 rounded text-[10px] font-medium flex-shrink-0"
            :class="levelClass(log.level)"
        >
          {{ levelLabel(log.level) }}
        </span>
        <span class="text-slate-400 break-all">{{ log.message }}</span>
      </div>
      <div v-if="filteredLogs.length === 0" class="text-center text-slate-600 py-4">
        暂无日志
      </div>
    </div>
  </div>
</template>
