<template>
  <div v-if="loading" class="loading-overlay">
    <!-- 有进度信息时显示进度条 -->
    <div v-if="loadingTotal > 0" class="loading-progress-container">
      <n-spin size="large" />
      <n-progress
        type="line"
        :percentage="percentage"
        :show-indicator="true"
        :height="24"
        status="success"
        class="progress-bar"
      />
      <div class="loading-message">
        {{ loadingMessage }}
      </div>
      <div class="loading-detail">
        {{ loadingProgress }} / {{ loadingTotal }} ({{ percentage }}%)
      </div>
    </div>
    <!-- 没有进度信息时显示加载提示 -->
    <div v-else class="loading-spinner-container">
      <n-spin size="large" />
      <div class="loading-message">
        {{ loadingMessage || '正在加载...' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NSpin, NProgress } from 'naive-ui'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()

const loading = computed(() => projectStore.loading)
const loadingProgress = computed(() => projectStore.loadingProgress)
const loadingTotal = computed(() => projectStore.loadingTotal)

const percentage = computed(() => {
  if (loadingTotal.value === 0) return 0
  return Math.min(Math.round((loadingProgress.value / loadingTotal.value) * 100), 100)
})

const loadingMessage = computed(() => {
  // 使用 store 中的消息，如果没有则使用默认消息
  return projectStore.loadingMessage || (loadingTotal.value === 0 
    ? '正在初始化...' 
    : '正在加载工程文件...')
})
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.8);
  z-index: 9999;
}

.loading-progress-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 32px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  min-width: 400px;
  max-width: 600px;
}

.loading-spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 32px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  min-width: 300px;
}

.progress-bar {
  width: 100%;
}

.loading-message {
  font-size: 16px;
  font-weight: 500;
  color: var(--n-text-color);
  text-align: center;
}

.loading-detail {
  font-size: 14px;
  color: var(--n-text-color-2);
  text-align: center;
}
</style>
