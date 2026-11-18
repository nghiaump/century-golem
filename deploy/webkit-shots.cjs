// Safari's engine (WebKit) at iPhone 15 Pro sizes + Desktop Safari: board screenshots and card-size checks.
// Chrome headless does NOT catch WebKit layout bugs (2026-11-17: every golem/hand card was 0 px wide on iPhone).
// Runs inside the Playwright image (has WebKit + its system libraries):
//   docker run --rm --network host -v "$PWD/deploy":/work -v /tmp/wk:/out -w /work \
//     mcr.microsoft.com/playwright:v1.58.2-noble bash -c "npm i --no-save -s playwright@1.58.2 >/dev/null && node webkit-shots.cjs [BASE_URL]"
// Exit 1 when a card is narrower than 20 px, a card sheet does not open on tap, the page scrolls sideways, or a page error occurs.
const { webkit, devices } = require('playwright')
const BASE = (process.argv[2] || 'http://127.0.0.1:8400').replace(/\/$/, '')
const OUT = process.env.OUT || '/out'
const RUNS = [
  ['iphone-portrait', 'iPhone 15 Pro', { width: 393, height: 659 }],   // Safari with the toolbar shown
  ['iphone-landscape', 'iPhone 15 Pro', { width: 852, height: 341 }],
  ['mac-safari', 'Desktop Safari', { width: 1440, height: 900 }],
]
;(async () => {
  const problems = []
  const b = await webkit.launch()
  for (const [name, dev, viewport] of RUNS) {
    const ctx = await b.newContext({ ...devices[dev], viewport })
    const p = await ctx.newPage()
    p.on('pageerror', (e) => problems.push(`${name}: page error ${String(e).slice(0, 120)}`))
    try {
      await p.goto(BASE + '/', { waitUntil: 'networkidle' })
      await p.getByRole('button', { name: /single player/i }).click()
      await p.route('**/api/single', async (r) => { const body = JSON.parse(r.request().postData()); await r.continue({ postData: JSON.stringify({ ...body, difficulty: 'easy', turnTimeout: 90 }) }) })
      await p.getByRole('button', { name: /start game/i }).click(); await p.waitForTimeout(1500)
      await p.getByRole('button', { name: /start game/i }).click()
      await p.waitForSelector('text=/your turn/i', { timeout: 60000 }); await p.waitForTimeout(1000)
      await p.screenshot({ path: `${OUT}/${name}-board.png` })
      const widths = await p.evaluate(() => [...document.querySelectorAll('button[aria-label^="Card "], button[aria-label^="Golem "], [aria-label="Your hand"] button')].map((e) => Math.round(e.getBoundingClientRect().width)))
      if (!widths.length || widths.some((w) => w < 20)) problems.push(`${name}: card widths ${JSON.stringify(widths)}`)
      const sideways = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      if (sideways > 1) problems.push(`${name}: page scrolls sideways by ${sideways}px`)
      if (dev !== 'Desktop Safari') {
        await p.locator('[aria-label^="Card 2,"]').first().tap(); await p.waitForTimeout(700)
        if (!(await p.locator('[role=dialog]').count())) problems.push(`${name}: tapping a market card opened no sheet`)
        await p.screenshot({ path: `${OUT}/${name}-sheet.png` })
      }
      console.log(`${name}: cards ${widths.join(',')}`)
    } catch (e) {
      problems.push(`${name}: flow failed ${String(e).split('\n')[0]}`)
      await p.screenshot({ path: `${OUT}/${name}-FAILED.png` }).catch(() => {})
    }
    await ctx.close()
  }
  await b.close()
  if (problems.length) { console.log(`\n${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`); process.exit(1) }
  console.log('\nWebKit checks: clean')
})()
