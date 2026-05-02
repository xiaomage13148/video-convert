<script setup lang="ts">
import TitleBar from './components/TitleBar.vue'
import StatusBar from './components/StatusBar.vue'
import HomeView from './views/HomeView.vue'
</script>

<template>
  <div class="flex flex-col h-screen bg-[#0F0F1A] text-slate-200 overflow-hidden">
    <TitleBar />
    <HomeView class="flex-1 overflow-hidden" />
    <StatusBar />
  </div>
</template>
