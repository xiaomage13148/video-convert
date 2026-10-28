<script lang="ts" setup>
import {computed, nextTick, onBeforeUnmount, onMounted, ref} from 'vue';
import {Check, Cpu, Settings2, SlidersHorizontal, Sparkles, Trash2, Volume2, X, Zap} from 'lucide-vue-next';
import {PRESETS, useSettingsStore} from '@/stores/settings';
import AppSelect from '@/components/AppSelect.vue';

const emit = defineEmits<{ close: [] }>();
const settingsStore = useSettingsStore();
const dialog = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
let previousFocus: HTMLElement | null = null;
const isNVENC = computed(() => settingsStore.settings.encoder.includes('nvenc'));
const presetList = computed(() => isNVENC.value ? settingsStore.nvencPresets : settingsStore.cpuPresets);
const qualityMin = computed(() => isNVENC.value ? 15 : 18);
const qualityMax = computed(() => isNVENC.value ? 35 : 28);
const qualityFill = computed(() => Math.max(0, Math.min(100,
  (settingsStore.settings.quality - qualityMin.value) / (qualityMax.value - qualityMin.value) * 100)));
const presetIcons = {fast: Zap, balanced: SlidersHorizontal, quality: Sparkles};
const profileOptions = [
  {value: 'baseline', label: 'Baseline'}, {value: 'main', label: 'Main'},
  {value: 'high', label: 'High'}, {value: 'high10', label: 'High 10'},
];
function markCustom() { settingsStore.activePreset = ''; }
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); emit('close'); return; }
  if (e.key !== 'Tab') return;
  const elements = dialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]');
  if (!elements?.length) return;
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
onMounted(async () => {
  previousFocus = document.activeElement as HTMLElement;
  await nextTick();
  closeButton.value?.focus();
});
onBeforeUnmount(() => previousFocus?.focus());
</script>

<template>
  <Teleport to="body">
    <div class="settings-backdrop fixed inset-0 z-50 flex items-center justify-center animate-fade-in" @click.self="emit('close')">
      <section ref="dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" aria-describedby="settings-description"
               class="settings-dialog animate-slide-up" @keydown="handleKeydown">
        <header class="flex shrink-0 items-center gap-3 px-6 py-5 border-b border-white/5">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/15 bg-violet-500/10 text-violet-300"><Settings2 :size="20"/></span>
          <div>
            <h2 id="settings-title" class="text-base font-semibold text-slate-100">转换设置</h2>
            <p id="settings-description" class="mt-1 text-[11px] text-slate-400">选择适合你的画质与速度，调整转换方式</p>
          </div>
          <button ref="closeButton" class="icon-button ml-auto" aria-label="关闭转换设置" @click="emit('close')"><X :size="18"/></button>
        </header>

        <div class="settings-body">
          <section class="settings-section">
            <div class="flex items-center justify-between mb-3">
              <h3 class="settings-section-title !mb-0">预设方案</h3>
              <span class="text-[10px] text-slate-400">{{ settingsStore.activePreset ? '一键配置编码参数' : '当前为自定义参数' }}</span>
            </div>
            <div class="grid grid-cols-3 gap-2.5">
              <button v-for="preset in PRESETS" :key="preset.name" :aria-pressed="settingsStore.activePreset === preset.name"
                      :class="{'is-active': settingsStore.activePreset === preset.name}" class="preset-card"
                      @click="settingsStore.applyPreset(preset.name)">
                <div class="flex items-center justify-between mb-3">
                  <component :is="presetIcons[preset.name as keyof typeof presetIcons]" :size="18"
                             :class="settingsStore.activePreset === preset.name ? 'text-violet-300' : 'text-slate-400'"/>
                  <Check v-if="settingsStore.activePreset === preset.name" :size="13" class="text-violet-300"/>
                </div>
                <div class="text-[13px] font-medium text-slate-200">{{ preset.label }}</div>
                <div class="text-[10px] mt-1.5 text-slate-400">{{ preset.description }}</div>
              </button>
            </div>
          </section>

          <section class="settings-section">
            <h3 class="settings-section-title"><SlidersHorizontal :size="14" class="text-violet-300"/>编码参数</h3>
            <div class="rounded-xl border border-white/5 bg-black/10 p-4 space-y-4">
              <div class="settings-row">
                <label for="setting-encoder">视频编码器</label>
                <AppSelect id="setting-encoder" v-model="settingsStore.settings.encoder" :options="settingsStore.encoderOptions"
                           aria-label="视频编码器" @change="markCustom"/>
              </div>
              <div class="settings-row">
                <label for="setting-preset">编码速度</label>
                <AppSelect id="setting-preset" v-model="settingsStore.settings.preset" :options="presetList"
                           aria-label="编码速度" @change="markCustom"/>
              </div>
              <div class="settings-row">
                <label for="setting-quality">画质参数</label>
                <div>
                  <div class="flex items-center gap-4 h-7">
                    <input id="setting-quality" v-model.number="settingsStore.settings.quality" :max="qualityMax" :min="qualityMin" :step="1"
                           :style="{background: 'linear-gradient(to right, #8b7aee ' + qualityFill + '%, #38384f ' + qualityFill + '%)'}"
                           class="quality-range flex-1 min-w-0" type="range" @input="markCustom"/>
                    <output for="setting-quality" class="count-badge !text-violet-200 min-w-8 text-center">{{ settingsStore.settings.quality }}</output>
                  </div>
                  <p class="text-[10px] text-slate-400 mt-1">数值越低，画质越高，文件也越大</p>
                </div>
              </div>
              <div class="settings-row">
                <label for="setting-profile">编码规格</label>
                <AppSelect id="setting-profile" v-model="settingsStore.settings.profile" :options="profileOptions"
                           aria-label="编码规格" @change="markCustom"/>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h3 class="settings-section-title"><Cpu :size="14" class="text-violet-300"/>硬件加速</h3>
            <div class="settings-option">
              <div class="flex items-center justify-between gap-4">
                <div><label for="setting-cuda" class="text-xs font-medium text-slate-200">CUDA 硬件解码</label>
                  <p id="cuda-description">{{ settingsStore.isCUDAAvailable ? '使用 NVIDIA 显卡加速视频解码' : '未检测到 NVIDIA 显卡，将使用 CPU 解码' }}</p></div>
                <input id="setting-cuda" v-model="settingsStore.settings.cudaEnabled" :disabled="!settingsStore.isCUDAAvailable"
                       aria-describedby="cuda-description" class="toggle" role="switch" type="checkbox"/>
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h3 class="settings-section-title"><Volume2 :size="14" class="text-violet-300"/>音频与文件</h3>
            <div class="space-y-2.5">
              <div class="settings-option flex items-center justify-between gap-4">
                <div><label for="setting-audio" class="text-xs font-medium text-slate-200">音频直接复制</label><p id="audio-description">尽量保留原始音质，减少重复编码</p></div>
                <input id="setting-audio" v-model="settingsStore.settings.audioCopy" aria-describedby="audio-description" class="toggle" role="switch" type="checkbox"/>
              </div>
              <div class="settings-option flex items-center justify-between gap-4">
                <div><label for="setting-delete" class="flex items-center gap-1.5 text-xs font-medium text-slate-200"><Trash2 :size="12" class="text-slate-400"/>转换成功后删除原文件</label>
                  <p id="delete-description" :class="{'!text-amber-300/80': settingsStore.settings.deleteOriginal}">{{ settingsStore.settings.deleteOriginal ? '已开启：转换成功后将永久删除源文件' : '保留源文件与转换后的文件' }}</p></div>
                <input id="setting-delete" v-model="settingsStore.settings.deleteOriginal" aria-describedby="delete-description" class="toggle" role="switch" type="checkbox"/>
              </div>
            </div>
          </section>
        </div>

        <footer class="flex shrink-0 items-center justify-between gap-4 px-6 py-4 border-t border-white/5 bg-black/10">
          <span class="text-[11px] text-slate-400">设置将应用于下一次转换</span>
          <button class="ui-button ui-button-primary min-w-24" @click="emit('close')"><Check :size="14"/>完成</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
