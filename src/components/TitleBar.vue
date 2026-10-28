<script lang="ts" setup>
import {Minus, Square, X} from 'lucide-vue-next';
import {useElectron} from '@/composables/useElectron';
import appIcon from '../../build/icon.svg';

const electron = useElectron();
</script>

<template>
  <div class="flex items-center justify-between h-11 shrink-0 pl-5 pr-2 bg-[#0c0c16] border-b border-white/5 select-none"
       style="-webkit-app-region: drag">
    <div class="flex items-center gap-2.5">
      <img :src="appIcon" alt="" aria-hidden="true" class="w-5 h-5" width="20" height="20"/>
      <span class="text-[13px] font-semibold tracking-wide text-slate-200">Video Convert <span class="text-violet-300">Pro</span></span>
    </div>
    <div class="flex items-center gap-0.5" style="-webkit-app-region: no-drag">
      <button
          aria-label="最小化窗口"
          class="w-10 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors rounded"
          @click="electron.windowMinimize()"
      >
        <Minus :size="14"/>
      </button>
      <button
          aria-label="最大化或还原窗口"
          class="w-10 h-8 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors rounded"
          @click="electron.windowMaximize()"
      >
        <Square :size="12"/>
      </button>
      <button
          aria-label="关闭窗口"
          class="w-10 h-8 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded"
          @click="electron.windowClose()"
      >
        <X :size="16"/>
      </button>
    </div>
  </div>
</template>
