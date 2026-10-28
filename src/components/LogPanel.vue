<script lang="ts" setup>
import {computed, nextTick, ref, watch} from 'vue';
import {useConvertStore} from '@/stores/convert';
import {ArrowDown, ChevronDown, Download, Search, Terminal, Trash2} from 'lucide-vue-next';
import AppSelect from '@/components/AppSelect.vue';

const convertStore = useConvertStore();

const searchQuery = ref('');
const levelFilter = ref<string>('');
const levelOptions = [
  {value: '', label: '全部'}, {value: 'info', label: '信息'},
  {value: 'warn', label: '警告'}, {value: 'error', label: '错误'},
];
const autoScroll = ref(true);
const collapsed = ref(false);
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
watch(collapsed, (value) => {
  if (!value) scrollToBottom();
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
  <section class="glass-panel log-panel flex flex-col overflow-hidden" :class="{'is-collapsed': collapsed}" aria-label="运行日志">
    <!-- 工具栏 -->
    <div class="flex shrink-0 items-center gap-2 px-4 py-2 border-b border-white/5">
      <button class="flex items-center gap-2 mr-auto py-1" :aria-expanded="!collapsed" aria-controls="conversion-logs" @click="collapsed = !collapsed">
        <Terminal :size="14" class="text-violet-300"/><span class="panel-title">运行日志</span>
        <span class="count-badge">{{ logCount }}</span>
        <ChevronDown :size="13" :class="{'-rotate-90': collapsed}" class="text-slate-400 transition-transform"/>
      </button>
      <div class="relative w-52">
        <Search :size="12" class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500"/>
        <input
            v-model="searchQuery"
            class="field !min-h-7 !py-1 !pl-7 w-full !text-[11px]"
            placeholder="搜索日志…"
            aria-label="搜索运行日志"
            type="text"
        />
      </div>

      <AppSelect id="log-level" v-model="levelFilter" :options="levelOptions" size="sm" class="w-[84px] shrink-0" aria-label="筛选日志级别"/>

      <button
          class="icon-button !w-7 !h-7"
          :disabled="!logCount"
          title="导出日志"
          @click="exportLogs"
      >
        <Download :size="14"/>
      </button>
      <button
          class="icon-button !w-7 !h-7"
          :disabled="!logCount"
          title="清空日志"
          @click="convertStore.clearLogs()"
      >
        <Trash2 :size="14"/>
      </button>
      <button
          :class="{'is-active': autoScroll}"
          :aria-pressed="autoScroll"
          class="icon-button !w-7 !h-7"
          title="自动滚动"
          @click="autoScroll = !autoScroll"
      >
        <ArrowDown :size="14"/>
      </button>

    </div>

    <!-- 日志列表 -->
    <div v-show="!collapsed" id="conversion-logs" ref="logContainer" class="flex-1 min-h-0 overflow-y-auto px-4 py-2 font-mono text-[11px] space-y-0.5">
      <div
          v-for="(log, i) in filteredLogs"
          :key="i"
          class="flex items-start gap-3 py-1 px-1 rounded hover:bg-white/5 transition-colors"
      >
        <span class="text-slate-400 flex-shrink-0">{{ formatTime(log.timestamp) }}</span>
        <span
            :class="levelClass(log.level)"
            class="px-1 rounded text-[10px] font-medium flex-shrink-0"
        >
          {{ levelLabel(log.level) }}
        </span>
        <span class="text-slate-400 break-all">{{ log.message }}</span>
      </div>
      <div v-if="filteredLogs.length === 0" class="flex h-full items-center justify-center gap-2 text-[11px] font-sans text-slate-400">
        <Terminal :size="14" class="text-slate-500"/>
        {{ logCount ? '没有匹配的日志，试试其他筛选条件' : '等待转换任务，运行信息将在这里显示' }}
      </div>
    </div>
  </section>
</template>
