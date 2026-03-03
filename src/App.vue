<script setup lang="ts">
import { RouterView } from 'vue-router'
import { NMessageProvider, NNotificationProvider, NDialogProvider } from 'naive-ui'
import { initTauri } from './utils/tauri-renderer'
import paper from 'paper'

initTauri()
let canvas = document.createElement('canvas')
paper.setup(canvas)
</script>

<template>
  <n-message-provider>
    <n-notification-provider>
      <n-dialog-provider>
        <RouterView />
      </n-dialog-provider>
    </n-notification-provider>
  </n-message-provider>
</template>

<style scoped>
</style>
