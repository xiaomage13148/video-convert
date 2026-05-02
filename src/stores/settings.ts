import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ConvertSettings, GPUInfo, Preset } from '../types'

const DEFAULT_SETTINGS: ConvertSettings = {
  encoder: 'h264_nvenc',
  preset: 'p4',
  quality: 23,
  maxBitrate: '0',
  profile: 'high',
  level: '5.1',
  audioCopy: true,
  cudaEnabled: true,
  deleteOriginal: true,
  concurrency: 3,
  outputDir: '',
}

export const PRESETS: Preset[] = [
  {
    name: 'fast',
    label: '极速',
    description: '最快速度，文件略大',
    settings: {
      encoder: 'h264_nvenc',
      preset: 'p1',
      quality: 28,
      maxBitrate: '0',
      profile: 'high',
      level: '5.1',
      cudaEnabled: true,
    },
  },
  {
    name: 'balanced',
    label: '均衡',
    description: '速度与质量平衡',
    settings: {
      encoder: 'h264_nvenc',
      preset: 'p4',
      quality: 23,
      maxBitrate: '0',
      profile: 'high',
      level: '5.1',
      cudaEnabled: true,
    },
  },
  {
    name: 'quality',
    label: '高质量',
    description: '最高质量，速度较慢',
    settings: {
      encoder: 'h264_nvenc',
      preset: 'p7',
      quality: 18,
      maxBitrate: '0',
      profile: 'high',
      level: '5.1',
      cudaEnabled: true,
    },
  },
]

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<ConvertSettings>({ ...DEFAULT_SETTINGS })
  const gpuInfo = ref<GPUInfo>({
    available: false,
    name: '',
    driverVersion: '',
    cudaVersion: '',
    memoryTotal: '',
  })
  const ffmpegAvailable = ref(false)
  const ffmpegPath = ref('')
  const activePreset = ref('balanced')

  const isCUDAAvailable = computed(() => gpuInfo.value.available)
  const isFFmpegReady = computed(() => ffmpegAvailable.value)

  const encoderOptions = computed(() => {
    const options = [
      { label: 'H.264 NVENC (GPU)', value: 'h264_nvenc' },
      { label: 'HEVC NVENC (GPU)', value: 'hevc_nvenc' },
    ]
    if (!gpuInfo.value.available) {
      options.push(
        { label: 'H.264 (CPU)', value: 'libx264' },
        { label: 'H.265 (CPU)', value: 'libx265' }
      )
    }
    return options
  })

  const nvencPresets = computed(() => [
    { label: 'P1 最快', value: 'p1' },
    { label: 'P2', value: 'p2' },
    { label: 'P3', value: 'p3' },
    { label: 'P4 均衡', value: 'p4' },
    { label: 'P5', value: 'p5' },
    { label: 'P6', value: 'p6' },
    { label: 'P7 最慢', value: 'p7' },
  ])

  const cpuPresets = computed(() => [
    { label: 'ultrafast', value: 'ultrafast' },
    { label: 'superfast', value: 'superfast' },
    { label: 'veryfast', value: 'veryfast' },
    { label: 'faster', value: 'faster' },
    { label: 'fast', value: 'fast' },
    { label: 'medium', value: 'medium' },
    { label: 'slow', value: 'slow' },
    { label: 'slower', value: 'slower' },
  ])

  function applyPreset(presetName: string) {
    const preset = PRESETS.find((p) => p.name === presetName)
    if (preset) {
      settings.value = { ...settings.value, ...preset.settings }
      activePreset.value = presetName
    }
  }

  function updateSettings(partial: Partial<ConvertSettings>) {
    settings.value = { ...settings.value, ...partial }
  }

  function setGPUInfo(info: GPUInfo) {
    gpuInfo.value = info
    if (!info.available) {
      settings.value.cudaEnabled = false
      if (settings.value.encoder.includes('nvenc')) {
        settings.value.encoder = 'libx264'
      }
    }
  }

  function setFFmpegStatus(available: boolean, path: string) {
    ffmpegAvailable.value = available
    ffmpegPath.value = path
  }

  function reset() {
    settings.value = { ...DEFAULT_SETTINGS }
    activePreset.value = 'balanced'
  }

  return {
    settings,
    gpuInfo,
    ffmpegAvailable,
    ffmpegPath,
    activePreset,
    isCUDAAvailable,
    isFFmpegReady,
    encoderOptions,
    nvencPresets,
    cpuPresets,
    applyPreset,
    updateSettings,
    setGPUInfo,
    setFFmpegStatus,
    reset,
  }
})
