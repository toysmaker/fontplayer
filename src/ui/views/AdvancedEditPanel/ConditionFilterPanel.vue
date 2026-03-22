<script setup lang="ts">
import { NEmpty } from 'naive-ui'
</script>

<template>
  <div class="condition-placeholder">
    <n-empty description="条件筛选（占位，与原工程一致）" />
  </div>
</template>

<style scoped>
.condition-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--dark-3);
}
</style>
