<script setup lang="ts">
import { Minus, Square, X } from 'lucide-vue-next'
import { useElectron } from '../composables/useElectron'

const electron = useElectron()
</script>

<template>
  <div class="flex items-center justify-between h-10 px-4 bg-[#0a0a14] border-b border-white/5 select-none" style="-webkit-app-region: drag">
    <div class="flex items-center gap-2">
      <div class="w-5 h-5 rounded bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      </div>
      <span class="text-sm font-medium text-slate-300">Video Convert Pro</span>
    </div>
    <div class="flex items-center gap-0.5" style="-webkit-app-region: no-drag">
      <button
        class="w-10 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors rounded"
        @click="electron.windowMinimize()"
      >
        <Minus :size="14" />
      </button>
      <button
        class="w-10 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors rounded"
        @click="electron.windowMaximize()"
      >
        <Square :size="12" />
      </button>
      <button
        class="w-10 h-8 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded"
        @click="electron.windowClose()"
      >
        <X :size="16" />
      </button>
    </div>
  </div>
</template>
