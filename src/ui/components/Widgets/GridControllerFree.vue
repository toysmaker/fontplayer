<script lang="ts" setup>
import { ref, type Ref, toRefs, onMounted, watch, onBeforeUnmount } from 'vue'
import { getGridCoords } from '@/core/utils/grid'
import type { IGridItem } from '@/core/types'

	const props = defineProps({
		dx: {
			type: Number,
			default: 0,
		},
		dy: {
			type: Number,
			default: 0,
		},
		ox: {
			type: Number,
			default: 500,
		},
		oy: {
			type: Number,
			default: 500,
		},
		width: {
			type: Number,
			default: 1000,
		},
		height: {
			type: Number,
			default: 1000,
		},
		centerSquareScale: {
			type: Number,
			default: 1,
		},
		dx1: {
			type: Number,
			default: 0,
		},
		dy1: {
			type: Number,
			default: 0,
		},
		dx2: {
			type: Number,
			default: 0,
		},
		dy2: {
			type: Number,
			default: 0,
		},
		dx3: {
			type: Number,
			default: 0,
		},
		dy3: {
			type: Number,
			default: 0,
		},
		dx4: {
			type: Number,
			default: 0,
		},
		dy4: {
			type: Number,
			default: 0,
		},
	})

	const emit = defineEmits<{ change: [IGridItem] }>()

	const { dx, dy, dx1, dy1, dx2, dy2, dx3, dy3, dx4, dy4, ox, oy, width, height, centerSquareScale } = toRefs(props)

	function emitGrid(next: IGridItem) {
		emit('change', next)
	}

	/** 拖拽时 props 尚未同步，必须用本次计算结果立刻重绘控件与命中几何 */
	function emitDragAndRedraw(next: IGridItem) {
		emitGrid(next)
		lastGridCoords.value = getGridCoords(next)
		renderFromGrid(next)
	}

	function gridFromProps(): IGridItem {
		return {
			dx: dx.value,
			dy: dy.value,
			dx1: dx1.value,
			dy1: dy1.value,
			dx2: dx2.value,
			dy2: dy2.value,
			dx3: dx3.value,
			dy3: dy3.value,
			dx4: dx4.value,
			dy4: dy4.value,
			ox: ox.value,
			oy: oy.value,
			width: width.value,
			height: height.value,
			centerSquareScale: centerSquareScale.value,
		}
	}

	const canvas: Ref<HTMLCanvasElement> = ref(null)
	const distance = (x1, y1, x2, y2) => {
		return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2))
	}

	const mapCanvas = (n: number) => {
		const el = canvas.value
		const w = el?.clientWidth || 500
		return (n / 1000) * w
	}
	const unmapCanvas = (n: number) => {
		const el = canvas.value
		const w = el?.clientWidth || 500
		return (n / w) * 1000
	}

	onMounted(() => {
		render()
		canvas.value?.addEventListener('mousedown', onMouseDown)
		canvas.value?.addEventListener('mousemove', onMouseMove)
	})
	onBeforeUnmount(() => {
		canvas.value?.removeEventListener('mousedown', onMouseDown)
		canvas.value?.removeEventListener('mousemove', onMouseMove)
	})
	const status = ref('none')
	const style = ref('default')
	let lastX = 0
	let lastY = 0
	const lastGrid = ref<IGridItem>({
		dx: dx.value,
		dy: dy.value,
		dx1: dx1.value,
		dy1: dy1.value,
		dx2: dx2.value,
		dy2: dy2.value,
		dx3: dx3.value,
		dy3: dy3.value,
		dx4: dx4.value,
		dy4: dy4.value,
		ox: ox.value,
		oy: oy.value,
		width: width.value,
		height: height.value,
		centerSquareScale: centerSquareScale.value,
	})
	const lastGridCoords = ref(getGridCoords(lastGrid.value))
	let mousedown = false
	const onMouseDown = (e: MouseEvent) => {
		mousedown = true
		lastGrid.value = {
			dx: dx.value,
			dy: dy.value,
			dx1: dx1.value,
			dy1: dy1.value,
			dx2: dx2.value,
			dy2: dy2.value,
			dx3: dx3.value,
			dy3: dy3.value,
			dx4: dx4.value,
			dy4: dy4.value,
			ox: ox.value,
			oy: oy.value,
			width: width.value,
			height: height.value,
			centerSquareScale: centerSquareScale.value,
		}
		lastGridCoords.value = getGridCoords(lastGrid.value)
		const x1 = ox.value + (lastGridCoords.value[1][1][0] - ox.value) * 0.5
    const y1 = oy.value + (lastGridCoords.value[1][1][1] - oy.value) * 0.5
    const x2 = ox.value + (lastGridCoords.value[1][2][0] - ox.value) * 0.5
    const y2 = oy.value + (lastGridCoords.value[1][2][1] - oy.value) * 0.5
    const x3 = ox.value + (lastGridCoords.value[2][1][0] - ox.value) * 0.5
    const y3 = oy.value + (lastGridCoords.value[2][1][1] - oy.value) * 0.5
    const x4 = ox.value + (lastGridCoords.value[2][2][0] - ox.value) * 0.5
    const y4 = oy.value + (lastGridCoords.value[2][2][1] - oy.value) * 0.5

		if (distance(
			e.offsetX, e.offsetY,
			mapCanvas(ox.value + dx.value),
			mapCanvas(oy.value + dy.value),
		) <= 20) {
			// 移动重心
			document.body.addEventListener('mouseup', onMouseUp)
			status.value = 'median-move'
		} else if (distance(
			e.offsetX, e.offsetY,
			mapCanvas(lastGridCoords.value[1][1][0]), mapCanvas(lastGridCoords.value[1][1][1]),
		) <= 20) {
			// 中宫左上角
			//document.body.addEventListener('mousemove', onMouseMove)
			document.body.addEventListener('mouseup', onMouseUp)
			status.value = 'center-square-left-top-move'
			style.value = 'center-square-left-top-move'
		} else if (distance(
			e.offsetX, e.offsetY,
			mapCanvas(lastGridCoords.value[1][2][0]), mapCanvas(lastGridCoords.value[1][2][1]),
		) <= 20) {
			// 中宫右上角
			//document.body.addEventListener('mousemove', onMouseMove)
			document.body.addEventListener('mouseup', onMouseUp)
			status.value = 'center-square-right-top-move'
			style.value = 'center-square-right-top-move'
		} else if (distance(
			e.offsetX, e.offsetY,
			mapCanvas(lastGridCoords.value[2][1][0]), mapCanvas(lastGridCoords.value[2][1][1]),
		) <= 20) {
			// 中宫左下角
			//document.body.addEventListener('mousemove', onMouseMove)
			document.body.addEventListener('mouseup', onMouseUp)
			status.value = 'center-square-left-bottom-move'
			style.value = 'center-square-left-bottom-move'
		} else if (distance(
			e.offsetX, e.offsetY,
			mapCanvas(lastGridCoords.value[2][2][0]), mapCanvas(lastGridCoords.value[2][2][1]),
		) <= 20) {
			// 中宫右下角
			//document.body.addEventListener('mousemove', onMouseMove)
			document.body.addEventListener('mouseup', onMouseUp)
			status.value = 'center-square-right-bottom-move'
			style.value = 'center-square-right-bottom-move'
		} else if (distance(
			e.offsetX, e.offsetY,
			mapCanvas(lastGridCoords.value[0][0][0]), mapCanvas(lastGridCoords.value[0][0][1]),
		) <= 20) {
			// 九宫左上角
			document.body.addEventListener('mouseup', onMouseUp)
			status.value = 'grid-left-top-move'
			style.value = 'grid-left-top-move'
		} else if (distance(
			e.offsetX, e.offsetY,
			mapCanvas(lastGridCoords.value[0][3][0]), mapCanvas(lastGridCoords.value[0][3][1]),
		) <= 20) {
			// 九宫右上角
			document.body.addEventListener('mouseup', onMouseUp)
			status.value = 'grid-right-top-move'
			style.value = 'grid-right-top-move'
		} else if (distance(
			e.offsetX, e.offsetY,
			mapCanvas(lastGridCoords.value[3][0][0]), mapCanvas(lastGridCoords.value[3][0][1]),
		) <= 20) {
			// 九宫左下角
			document.body.addEventListener('mouseup', onMouseUp)
			status.value = 'grid-left-bottom-move'
			style.value = 'grid-left-bottom-move'
		} else if (distance(
			e.offsetX, e.offsetY,
			mapCanvas(lastGridCoords.value[3][3][0]), mapCanvas(lastGridCoords.value[3][3][1]),
		) <= 20) {
			// 九宫右下角
			document.body.addEventListener('mouseup', onMouseUp)
			status.value = 'grid-right-bottom-move'
			style.value = 'grid-right-bottom-move'
		} else if (distance(
			e.offsetX, e.offsetY,
			mapCanvas(x1), mapCanvas(y1),
		) <= 20) {
			// 中宫缩放左上角
			document.body.addEventListener('mouseup', onMouseUp)
			status.value = 'center-square-scale-left-top-move'
			style.value = 'center-square-scale-left-top-move'
		} else if (distance(
			e.offsetX, e.offsetY,
			mapCanvas(x2), mapCanvas(y2),
		) <= 20) {
			// 中宫缩放右上角
			document.body.addEventListener('mouseup', onMouseUp)
			status.value = 'center-square-scale-right-top-move'
			style.value = 'center-square-scale-right-top-move'
		} else if (distance(
			e.offsetX, e.offsetY,
			mapCanvas(x3), mapCanvas(y3),
		) <= 20) {
			// 中宫缩放左下角
			document.body.addEventListener('mouseup', onMouseUp)
			status.value = 'center-square-scale-left-bottom-move'
			style.value = 'center-square-scale-left-bottom-move'
		} else if (distance(
			e.offsetX, e.offsetY,
			mapCanvas(x4), mapCanvas(y4),
		) <= 20) {
			// 中宫缩放右下角
			document.body.addEventListener('mouseup', onMouseUp)
			status.value = 'center-square-scale-right-bottom-move'
			style.value = 'center-square-scale-right-bottom-move'
		} else if (distance(
			e.offsetX, e.offsetY,
			mapCanvas(ox.value),
			mapCanvas(oy.value),
		) <= 50) {
			// 中心点, 移动整个网格
			document.body.addEventListener('mouseup', onMouseUp)
			status.value = 'grid-move'
		}
		lastX = e.offsetX
		lastY = e.offsetY
	}
	const onMouseMove = (e: MouseEvent) => {
		if (mousedown) {
			switch (status.value) {
				case 'median-move': {
					const dx = unmapCanvas(e.offsetX - lastX)
					const dy = unmapCanvas(e.offsetY - lastY)
					emitDragAndRedraw({
						...lastGrid.value,
						dx: dx + lastGrid.value.dx,
						dy: dy + lastGrid.value.dy,
					})
					break
				}
				case 'grid-move': {
					const dx = unmapCanvas(e.offsetX - lastX)
					const dy = unmapCanvas(e.offsetY - lastY)
					emitDragAndRedraw({
						...lastGrid.value,
						ox: dx + lastGrid.value.ox,
						oy: dy + lastGrid.value.oy,
					})
					break
				}
				case 'center-square-left-top-move': {
					const dx = unmapCanvas(e.offsetX - lastX)
					const dy = unmapCanvas(e.offsetY - lastY)
					emitDragAndRedraw({
						...lastGrid.value,
						dx1: dx + lastGrid.value.dx1,
						dy1: dy + lastGrid.value.dy1,
					})
					break
				}
				case 'center-square-right-top-move': {
					const dx = unmapCanvas(e.offsetX - lastX)
					const dy = unmapCanvas(e.offsetY - lastY)
					emitDragAndRedraw({
						...lastGrid.value,
						dx2: dx + lastGrid.value.dx2,
						dy2: dy + lastGrid.value.dy2,
					})
					break
				}
				case 'center-square-left-bottom-move': {
					const dx = unmapCanvas(e.offsetX - lastX)
					const dy = unmapCanvas(e.offsetY - lastY)
					emitDragAndRedraw({
						...lastGrid.value,
						dx3: dx + lastGrid.value.dx3,
						dy3: dy + lastGrid.value.dy3,
					})
					break
				}
				case 'center-square-right-bottom-move': {
					const dx = unmapCanvas(e.offsetX - lastX)
					const dy = unmapCanvas(e.offsetY - lastY)
					emitDragAndRedraw({
						...lastGrid.value,
						dx4: dx + lastGrid.value.dx4,
						dy4: dy + lastGrid.value.dy4,
					})
					break
				}
				case 'grid-left-top-move': {
					const dx = unmapCanvas(e.offsetX - lastX)
					const dy = unmapCanvas(e.offsetY - lastY)
					emitDragAndRedraw({
						...lastGrid.value,
						width: lastGrid.value.width - dx * 2,
						height: lastGrid.value.height - dy * 2,
					})
					break
				}
				case 'grid-right-top-move': {
					const dx = unmapCanvas(e.offsetX - lastX)
					const dy = unmapCanvas(e.offsetY - lastY)
					emitDragAndRedraw({
						...lastGrid.value,
						width: lastGrid.value.width + dx * 2,
						height: lastGrid.value.height - dy * 2,
					})
					break
				}
				case 'grid-left-bottom-move': {
					const dx = unmapCanvas(e.offsetX - lastX)
					const dy = unmapCanvas(e.offsetY - lastY)
					emitDragAndRedraw({
						...lastGrid.value,
						width: lastGrid.value.width - dx * 2,
						height: lastGrid.value.height + dy * 2,
					})
					break
				}
				case 'grid-right-bottom-move': {
					const dx = unmapCanvas(e.offsetX - lastX)
					const dy = unmapCanvas(e.offsetY - lastY)
					emitDragAndRedraw({
						...lastGrid.value,
						width: lastGrid.value.width + dx * 2,
						height: lastGrid.value.height + dy * 2,
					})
					break
				}
				case 'center-square-scale-left-top-move': {
					const scale = unmapCanvas(e.offsetX - lastX) / (lastGridCoords.value[1][1][0] - lastGrid.value.ox)
					emitDragAndRedraw({
						...lastGrid.value,
						centerSquareScale: scale + lastGrid.value.centerSquareScale,
					})
					break
				}
				case 'center-square-scale-right-top-move': {
					const scale = unmapCanvas(e.offsetX - lastX) / (lastGridCoords.value[1][2][0] - lastGrid.value.ox)
					emitDragAndRedraw({
						...lastGrid.value,
						centerSquareScale: scale + lastGrid.value.centerSquareScale,
					})
					break
				}
				case 'center-square-scale-left-bottom-move': {
					const scale = unmapCanvas(e.offsetX - lastX) / (lastGridCoords.value[2][1][0] - lastGrid.value.ox)
					emitDragAndRedraw({
						...lastGrid.value,
						centerSquareScale: scale + lastGrid.value.centerSquareScale,
					})
					break
				}
				case 'center-square-scale-right-bottom-move': {
					const scale = unmapCanvas(e.offsetX - lastX) / (lastGridCoords.value[2][2][0] - lastGrid.value.ox)
					emitDragAndRedraw({
						...lastGrid.value,
						centerSquareScale: scale + lastGrid.value.centerSquareScale,
					})
					break
				}
			}
		} else {
			const x1 = ox.value + (lastGridCoords.value[1][1][0] - ox.value) * 0.5
			const y1 = oy.value + (lastGridCoords.value[1][1][1] - oy.value) * 0.5
			const x2 = ox.value + (lastGridCoords.value[1][2][0] - ox.value) * 0.5
			const y2 = oy.value + (lastGridCoords.value[1][2][1] - oy.value) * 0.5
			const x3 = ox.value + (lastGridCoords.value[2][1][0] - ox.value) * 0.5
			const y3 = oy.value + (lastGridCoords.value[2][1][1] - oy.value) * 0.5
			const x4 = ox.value + (lastGridCoords.value[2][2][0] - ox.value) * 0.5
			const y4 = oy.value + (lastGridCoords.value[2][2][1] - oy.value) * 0.5
			if (distance(
				e.offsetX, e.offsetY,
				mapCanvas(lastGridCoords.value[1][1][0]), mapCanvas(lastGridCoords.value[1][1][1]),
			) <= 20) {
				// 中宫左上角
				style.value = 'center-square-left-top-move'
			} else if (distance(
				e.offsetX, e.offsetY,
				mapCanvas(lastGridCoords.value[1][2][0]), mapCanvas(lastGridCoords.value[1][2][1]),
			) <= 20) {
				// 中宫右上角
				style.value = 'center-square-right-top-move'
			} else if (distance(
				e.offsetX, e.offsetY,
				mapCanvas(lastGridCoords.value[2][1][0]), mapCanvas(lastGridCoords.value[2][1][1]),
			) <= 20) {
				// 中宫左下角
				style.value = 'center-square-left-bottom-move'
			} else if (distance(
				e.offsetX, e.offsetY,
				mapCanvas(lastGridCoords.value[2][2][0]), mapCanvas(lastGridCoords.value[2][2][1]),
			) <= 20) {
				// 中宫右下角
				style.value = 'center-square-right-bottom-move'
			} else if (distance(
				e.offsetX, e.offsetY,
				mapCanvas(lastGridCoords.value[0][0][0]), mapCanvas(lastGridCoords.value[0][0][1]),
			) <= 20) {
				// 九宫左上角
				style.value = 'grid-left-top-move'
			} else if (distance(
				e.offsetX, e.offsetY,
				mapCanvas(lastGridCoords.value[0][3][0]), mapCanvas(lastGridCoords.value[0][3][1]),
			) <= 20) {
				// 九宫右上角
				style.value = 'grid-right-top-move'
			} else if (distance(
				e.offsetX, e.offsetY,
				mapCanvas(lastGridCoords.value[3][0][0]), mapCanvas(lastGridCoords.value[3][0][1]),
			) <= 20) {
				// 九宫左下角
				style.value = 'grid-left-bottom-move'
			} else if (distance(
				e.offsetX, e.offsetY,
				mapCanvas(lastGridCoords.value[3][3][0]), mapCanvas(lastGridCoords.value[3][3][1]),
			) <= 20) {
				// 九宫右下角
				style.value = 'grid-right-bottom-move'
			} else if (distance(
				e.offsetX, e.offsetY,
				mapCanvas(x1), mapCanvas(y1),
			) <= 20) {
				// 中宫缩放左上角
				style.value = 'center-square-scale-left-top-move'
			} else if (distance(
				e.offsetX, e.offsetY,
				mapCanvas(x2), mapCanvas(y2),
			) <= 20) {
				// 中宫缩放右上角
				style.value = 'center-square-scale-right-top-move'
			} else if (distance(
				e.offsetX, e.offsetY,
				mapCanvas(x3), mapCanvas(y3),
			) <= 20) {
				// 中宫缩放左下角
				style.value = 'center-square-scale-left-bottom-move'
			} else if (distance(
				e.offsetX, e.offsetY,
				mapCanvas(x4), mapCanvas(y4),
			) <= 20) {
				// 中宫缩放右下角
				style.value = 'center-square-scale-right-bottom-move'
			} else {
				style.value = 'default'
			}
		}
	}
	const onMouseUp = () => {
		status.value = 'none'
		lastGrid.value = {
			dx: dx.value,
			dy: dy.value,
			dx1: dx1.value,
			dy1: dy1.value,
			dx2: dx2.value,
			dy2: dy2.value,
			dx3: dx3.value,
			dy3: dy3.value,
			dx4: dx4.value,
			dy4: dy4.value,
			ox: ox.value,
			oy: oy.value,
			width: width.value,
			height: height.value,
			centerSquareScale: centerSquareScale.value,
		}
		lastGridCoords.value = getGridCoords(lastGrid.value)
		mousedown = false
		document.body.removeEventListener('mouseup', onMouseUp)
	}

	watch([dx, dy, width, height, centerSquareScale, dx1, dy1, dx2, dy2, dx3, dy3, dx4, dy4, ox, oy], () => {
		if (mousedown) {
			return
		}
		lastGrid.value = {
			dx: dx.value,
			dy: dy.value,
			dx1: dx1.value,
			dy1: dy1.value,
			dx2: dx2.value,
			dy2: dy2.value,
			dx3: dx3.value,
			dy3: dy3.value,
			dx4: dx4.value,
			dy4: dy4.value,
			ox: ox.value,
			oy: oy.value,
			width: width.value,
			height: height.value,
			centerSquareScale: centerSquareScale.value,
		}
		lastGridCoords.value = getGridCoords(lastGrid.value)
		render()
	}, { deep: true })

	function renderFromGrid(grid: IGridItem) {
		if (!canvas.value) return
		const gridCoords = getGridCoords(grid)

		const ctx = canvas.value.getContext('2d')
		if (!ctx) return
		ctx.clearRect(0, 0, 1000, 1000)

		ctx.strokeStyle = '#811616'
		ctx.lineWidth = 2

		ctx.beginPath()
		ctx.moveTo(gridCoords[0][1][0], gridCoords[0][1][1])
		ctx.lineTo(gridCoords[3][1][0], gridCoords[3][1][1])
		ctx.stroke()
		ctx.closePath()

		ctx.beginPath()
		ctx.moveTo(gridCoords[0][2][0], gridCoords[0][2][1])
		ctx.lineTo(gridCoords[3][2][0], gridCoords[3][2][1])
		ctx.stroke()
		ctx.closePath()

		ctx.beginPath()
		ctx.moveTo(gridCoords[1][0][0], gridCoords[1][0][1])
		ctx.lineTo(gridCoords[1][3][0], gridCoords[1][3][1])
		ctx.stroke()
		ctx.closePath()

		ctx.beginPath()
		ctx.moveTo(gridCoords[2][0][0], gridCoords[2][0][1])
		ctx.lineTo(gridCoords[2][3][0], gridCoords[2][3][1])
		ctx.stroke()
		ctx.closePath()

		const gx = grid.ox
		const gy = grid.oy
		const x1 = gx + (gridCoords[1][1][0] - gx) * 0.5
		const y1 = gy + (gridCoords[1][1][1] - gy) * 0.5
		const x2 = gx + (gridCoords[1][2][0] - gx) * 0.5
		const y2 = gy + (gridCoords[1][2][1] - gy) * 0.5
		const x3 = gx + (gridCoords[2][1][0] - gx) * 0.5
		const y3 = gy + (gridCoords[2][1][1] - gy) * 0.5
		const x4 = gx + (gridCoords[2][2][0] - gx) * 0.5
		const y4 = gy + (gridCoords[2][2][1] - gy) * 0.5

		ctx.beginPath()
		ctx.strokeStyle = '#153063'
		ctx.moveTo(x1, y1)
		ctx.lineTo(x2, y2)
		ctx.lineTo(x4, y4)
		ctx.lineTo(x3, y3)
		ctx.lineTo(x1, y1)
		ctx.stroke()
		ctx.closePath()

		const medianCenter = [gx + grid.dx, gy + grid.dy]
		ctx.fillStyle = '#153063'
		ctx.lineWidth = 0
		ctx.beginPath()
		ctx.arc(medianCenter[0], medianCenter[1], 20, 0, 2 * Math.PI)
		ctx.closePath()
		ctx.fill()
	}

	const render = () => {
		renderFromGrid(gridFromProps())
	}
</script>

<template>
  <div class="grid-controller">
    <canvas
      ref="canvas"
      :width="1000"
      :height="1000"
      class="grid-canvas"
      :class="{
        'left-top': style.includes('left-top'),
        'right-top': style.includes('right-top'),
        'left-bottom': style.includes('left-bottom'),
        'right-bottom': style.includes('right-bottom'),
      }"
    />
  </div>
</template>

<style scoped>
.left-top,
.right-bottom {
  cursor: nwse-resize;
}
.left-bottom,
.right-top {
  cursor: nesw-resize;
}
.grid-controller {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}
.grid-canvas {
  width: 500px;
  height: 500px;
  max-width: 100%;
  max-height: 100%;
  background: transparent;
}
</style>