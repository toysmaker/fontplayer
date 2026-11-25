import { loaded, loading, loadingMsg, total } from './loading'

/**
 * 简单的 sleep，默认让出事件循环一帧
 */
export const sleep = (ms = 0) => {
	return new Promise<void>(resolve => setTimeout(resolve, ms))
}

const ensureLoading = () => {
	if (!loading.value) {
		loading.value = true
	}
}

/** 进度观察者：封装期（createFont）内部进度对外桥接的唯一出口；构建器在 create 前设置、结束后清除 */
let progressObserver: ((done: number, total: number) => void) | null = null

export const setProgressObserver = (cb: ((done: number, total: number) => void) | null) => {
	progressObserver = cb
}

const notifyObserver = () => {
	if (progressObserver) {
		progressObserver(loaded.value, total.value)
	}
}

/**
 * 在需要更大的进度预算时调用
 */
export const reserveProgressBudget = (estimate: number) => {
	if (!Number.isFinite(estimate) || estimate <= 0) {
		return
	}

	ensureLoading()
	const remaining = total.value - loaded.value
	if (remaining < estimate) {
		total.value += estimate - remaining
	}
	notifyObserver()
}

/**
 * 更新 loadingMsg，并累加 loaded
 */
export const incrementProgress = (message?: string, step = 1) => {
	if (!Number.isFinite(step) || step <= 0) {
		return
	}

	ensureLoading()

	if (message) {
		loadingMsg.value = message
	}

	loaded.value += step

	// 如果没有预算，保证 total 至少和 loaded 持平，避免百分比 NaN
	if (total.value < loaded.value) {
		total.value = loaded.value
	}
	notifyObserver()
}

export const setProgressMessage = (message: string) => {
	ensureLoading()
	loadingMsg.value = message
}

/**
 * 大循环中调用，周期性让出事件循环
 */
export const yieldToEventLoop = async (
	iteration: number,
	chunkSize = 120,
	delay = 0
) => {
	if (iteration <= 0 || chunkSize <= 0) {
		return
	}

	if (iteration % chunkSize === 0) {
		await sleep(delay)
	}
}

