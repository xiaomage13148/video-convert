<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { Cpu, Terminal } from 'lucide-vue-next'

const settingsStore = useSettingsStore()

const gpuLabel = computed(() => {
  if (!settingsStore.gpuInfo.available) return '未检测到 GPU'
  return settingsStore.gpuInfo.name
})

const ffmpegLabel = computed(() => {
  return settingsStore.ffmpegAvailable ? 'FFmpeg 已就绪' : 'FFmpeg 未安装'
})
</script>

<template>
  <div class="flex items-center justify-between px-4 py-1.5 bg-[#0a0a14] border-t border-white/5 text-[11px]">
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-1.5">
        <div
          class="w-1.5 h-1.5 rounded-full"
          :class="settingsStore.ffmpegAvailable ? 'bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.5)]' : 'bg-red-400 shadow-[0_0_4px_rgba(239,68,68,0.5)]'"
        />
        <Terminal :size="11" class="text-slate-500" />
        <span class="text-slate-500">{{ ffmpegLabel }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <div
          class="w-1.5 h-1.5 rounded-full"
          :class="settingsStore.gpuInfo.available ? 'bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.5)]' : 'bg-yellow-400 shadow-[0_0_4px_rgba(245,158,11,0.5)]'"
        />
        <Cpu :size="11" class="text-slate-500" />
        <span class="text-slate-500">{{ gpuLabel }}</span>
      </div>
    </div>
    <div class="text-slate-600">
      Video Convert Pro v1.0
    </div>
  </div>
</template>
