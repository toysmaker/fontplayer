<template>
  <div class="welcome-container">
    <n-empty description="欢迎使用字玩">
      <template #extra>
        <n-button type="primary" @click="goToEditor">
          打开工程
        </n-button>
      </template>
    </n-empty>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NEmpty, NButton } from 'naive-ui'

const router = useRouter()

const goToEditor = () => {
  router.push('/editor')
}
</script>

<style scoped>
.welcome-container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
