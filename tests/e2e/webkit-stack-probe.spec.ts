import { test } from '@playwright/test'
test('webkit stack format probe', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.waitForLoadState('networkidle')
  const report = await page.evaluate(() => {
    const out: string[] = []
    const err = new Error('probe')
    out.push('RAW STACK:\n' + (err.stack || 'NO STACK'))
    // 各行的原始格式
    const lines = (err.stack || '').split('\n')
    out.push('LINE COUNT: ' + lines.length)
    lines.slice(0, 8).forEach((l, i) => out.push(`L${i}: [${l}]`))
    return out.join('\n')
  })
  console.log('\n[STACKFMT]\n' + report + '\n')
})
