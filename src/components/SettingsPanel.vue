<script setup lang="ts">
import {computed} from 'vue';
import {Cpu, HardDrive, Trash2, Volume2, X, Zap} from 'lucide-vue-next';
import {PRESETS, useSettingsStore} from '@/stores/settings';

const emit = defineEmits<{ close: [] }>();

const settingsStore = useSettingsStore();

const isNVENC = computed(() => settingsStore.settings.encoder.includes('nvenc'));
const presetList = computed(() =>
    isNVENC.value ? settingsStore.nvencPresets : settingsStore.cpuPresets
);

function selectPreset(name: string) {
  settingsStore.applyPreset(name);
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
       @click.self="emit('close')">
    <div class="glass-panel w-[520px] max-h-[80vh] overflow-y-auto p-6 animate-slide-up" @click.stop>
      <!-- 标题 -->
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-lg font-semibold text-slate-200">转换设置</h2>
        <button
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            @click="emit('close')"
        >
          <X :size="18"/>
        </button>
      </div>

      <!-- 预设方案 -->
      <div class="mb-5">
        <label class="text-xs text-slate-500 uppercase tracking-wider mb-2 block">预设方案</label>
        <div class="grid grid-cols-3 gap-2">
          <button
              v-for="preset in PRESETS"
              :key="preset.name"
              class="p-3 rounded-lg border transition-all duration-200 text-center"
              :class="settingsStore.activePreset === preset.name
              ? 'border-primary/50 bg-primary/10 text-primary-lighter glow-primary'
              : 'border-white/5 bg-white/3 text-slate-400 hover:bg-white/5 hover:text-slate-300'"
              @click="selectPreset(preset.name)"
          >
            <Zap :size="18" class="mx-auto mb-1"/>
            <div class="text-sm font-medium">{{ preset.label }}</div>
            <div class="text-[11px] mt-0.5 opacity-70">{{ preset.description }}</div>
          </button>
        </div>
      </div>

      <!-- 编码参数 -->
      <div class="mb-5">
        <label class="text-xs text-slate-500 uppercase tracking-wider mb-2 block">编码参数</label>
        <div class="space-y-3">
          <!-- 编码器 -->
          <div class="flex items-center gap-3">
            <Cpu :size="16" class="text-slate-500 flex-shrink-0"/>
            <label class="text-sm text-slate-400 w-16">编码器</label>
            <select
                v-model="settingsStore.settings.encoder"
                class="flex-1 px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary/30"
            >
              <option v-for="opt in settingsStore.encoderOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- 预设 -->
          <div class="flex items-center gap-3">
            <Zap :size="16" class="text-slate-500 flex-shrink-0"/>
            <label class="text-sm text-slate-400 w-16">预设</label>
            <select
                v-model="settingsStore.settings.preset"
                class="flex-1 px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary/30"
            >
              <option v-for="opt in presetList" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- 质量因子 -->
          <div class="flex items-center gap-3">
            <HardDrive :size="16" class="text-slate-500 flex-shrink-0"/>
            <label class="text-sm text-slate-400 w-16">质量</label>
            <input
                v-model.number="settingsStore.settings.quality"
                type="range"
                :min="isNVENC ? 15 : 18"
                :max="isNVENC ? 35 : 28"
                :step="1"
                class="flex-1 accent-primary"
            />
            <span class="text-sm text-slate-300 w-8 text-right font-mono">{{ settingsStore.settings.quality }}</span>
          </div>

          <!-- Profile -->
          <div class="flex items-center gap-3">
            <label class="text-sm text-slate-400 w-16 ml-7">Profile</label>
            <select
                v-model="settingsStore.settings.profile"
                class="flex-1 px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-primary/30"
            >
              <option value="baseline">Baseline</option>
              <option value="main">Main</option>
              <option value="high">High</option>
              <option value="high10">High 10</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 硬件加速 -->
      <div class="mb-5">
        <label class="text-xs text-slate-500 uppercase tracking-wider mb-2 block">硬件加速</label>
        <div class="flex items-center justify-between p-3 bg-white/3 rounded-lg">
          <div class="flex items-center gap-2">
            <Cpu :size="16" class="text-primary-lighter"/>
            <span class="text-sm text-slate-300">CUDA 硬件解码</span>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
                v-model="settingsStore.settings.cudaEnabled"
                type="checkbox"
                class="sr-only peer"
                :disabled="!settingsStore.isCUDAAvailable"
            />
            <div
                class="w-9 h-5 rounded-full transition-colors duration-200 peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary/30"
                :class="!settingsStore.isCUDAAvailable ? 'bg-slate-600 opacity-50' : 'bg-slate-600'"
            />
            <div
                class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-4"
            />
          </label>
        </div>
        <p v-if="!settingsStore.isCUDAAvailable" class="text-[11px] text-red-400 mt-1 ml-1">
          未检测到 NVIDIA GPU，CUDA 加速不可用
        </p>
      </div>

      <!-- 音频 -->
      <div class="mb-5">
        <label class="text-xs text-slate-500 uppercase tracking-wider mb-2 block">音频</label>
        <div class="flex items-center justify-between p-3 bg-white/3 rounded-lg">
          <div class="flex items-center gap-2">
            <Volume2 :size="16" class="text-primary-lighter"/>
            <span class="text-sm text-slate-300">音频直接复制</span>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input v-model="settingsStore.settings.audioCopy" type="checkbox" class="sr-only peer"/>
            <div
                class="w-9 h-5 rounded-full bg-slate-600 peer-checked:bg-primary transition-colors duration-200 peer-focus:ring-2 peer-focus:ring-primary/30"/>
            <div
                class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-4"/>
          </label>
        </div>
      </div>

      <!-- 后处理 -->
      <div class="mb-5">
        <label class="text-xs text-slate-500 uppercase tracking-wider mb-2 block">后处理</label>
        <div class="flex items-center justify-between p-3 bg-white/3 rounded-lg">
          <div class="flex items-center gap-2">
            <Trash2 :size="16" class="text-primary-lighter"/>
            <span class="text-sm text-slate-300">转换后删除原文件</span>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input v-model="settingsStore.settings.deleteOriginal" type="checkbox" class="sr-only peer"/>
            <div
                class="w-9 h-5 rounded-full bg-slate-600 peer-checked:bg-primary transition-colors duration-200 peer-focus:ring-2 peer-focus:ring-primary/30"/>
            <div
                class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-4"/>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
