import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ConvertTask, TaskStatus, ProgressData, StatusData, LogEntry } from '../types'

export const useConvertStore = defineStore('convert', () => {
  const taskList = ref<ConvertTask[]>([])
  const isConverting = ref(false)
  const isPaused = ref(false)
  const logs = ref<LogEntry[]>([])

  const tasks = computed(() => {
    const map = new Map<string, ConvertTask>()
    for (const t of taskList.value) {
      map.set(t.id, t)
    }
    return map
  })

  const waitingCount = computed(() => taskList.value.filter((t) => t.status === 'waiting').length)
  const convertingCount = computed(() => taskList.value.filter((t) => t.status === 'converting').length)
  const successCount = computed(() => taskList.value.filter((t) => t.status === 'success').length)
  const failedCount = computed(() => taskList.value.filter((t) => t.status === 'failed').length)
  const cancelledCount = computed(() => taskList.value.filter((t) => t.status === 'cancelled').length)

  const totalProgress = computed(() => {
    const list = taskList.value
    if (list.length === 0) return 0
    const total = list.reduce((sum, t) => sum + t.progress, 0)
    return Math.round(total / list.length)
  })

  const completedCount = computed(() => successCount.value + failedCount.value + cancelledCount.value)
  const totalCount = computed(() => taskList.value.length)

  function updateTaskStatus(data: StatusData) {
    const idx = taskList.value.findIndex((t) => t.id === data.id)
    if (idx >= 0) {
      const task = taskList.value[idx]
      task.status = data.status
      task.progress = data.progress
      if (data.error) task.error = data.error
      if (data.codec) task.codec = data.codec
      if (data.duration) task.duration = data.duration
    } else {
      taskList.value.push({
        id: data.id,
        fileName: data.fileName,
        inputPath: data.id,
        outputPath: '',
        status: data.status,
        progress: data.progress,
        speed: '',
        currentTime: '',
        codec: data.codec || '',
        duration: data.duration || 0,
        error: data.error,
      })
    }
  }

  function updateTaskProgress(data: ProgressData) {
    const task = taskList.value.find((t) => t.id === data.id)
    if (task) {
      task.progress = data.percent
      task.speed = data.speed
      task.currentTime = data.currentTime
    }
  }

  function addLog(entry: LogEntry) {
    logs.value.push(entry)
    if (logs.value.length > 10000) {
      logs.value = logs.value.slice(-5000)
    }
  }

  function clearLogs() {
    logs.value = []
  }

  function reset() {
    taskList.value = []
    isConverting.value = false
    isPaused.value = false
  }

  return {
    tasks,
    taskList,
    isConverting,
    isPaused,
    logs,
    waitingCount,
    convertingCount,
    successCount,
    failedCount,
    cancelledCount,
    totalProgress,
    completedCount,
    totalCount,
    updateTaskStatus,
    updateTaskProgress,
    addLog,
    clearLogs,
    reset,
  }
})
