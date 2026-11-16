#!/usr/bin/env node
// Chụp màn hình mọi màn chính ở nhiều viewport + kiểm tra UI tự động (dùng cho thiết kế lại giao diện, README).
//   node deploy/ui-shots.mjs [BASE_URL] [OUT_DIR] [--only desktop|mobile] [--rest]
//   mặc định BASE_URL=http://127.0.0.1:8400 (stack local), OUT_DIR=./ui-shots
// Cần playwright-core (biến PLAYWRIGHT_CORE, mặc định bản npx có sẵn trên rtx) + Chrome (/usr/bin/google-chrome).
// Báo lỗi (exit 1) khi: request ra ngoài BASE_URL (font/CDN ngoài), lỗi console, tràn ngang; trên viewport cảm ứng:
// chữ hiển thị < 12px hoặc nút/link < 44px. Ván chơi dùng AI Easy + 5 giây/lượt để có diễn biến nhanh.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || '/home/nghia/.npm/_npx/f0a362733743bae2/node_modules/playwright-core')

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--only')
const BASE = (pos[0] || 'http://127.0.0.1:8400').replace(/\/$/, '')
const OUT = pos[1] || 'ui-shots'
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = [
  { name: 'desktop-1440', kind: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'desktop-1280', kind: 'desktop', viewport: { width: 1280, height: 720 } },
  { name: 'desktop-1024', kind: 'desktop', viewport: { width: 1024, height: 768 } },
  { name: 'mobile-390', kind: 'mobile', viewport: { width: 390, height: 844 }, touch: true },
  { name: 'mobile-320', kind: 'mobile', viewport: { width: 320, height: 640 }, touch: true },
  { name: 'landscape-844', kind: 'mobile', viewport: { width: 844, height: 390 }, touch: true },
].filter((v) => !only || v.kind === only)

// Expected noise: auth is disabled on purpose (404), sounds may be blocked before a user gesture.
const IGNORED = [/\/auth\/profile/, /play\(\) failed|NotAllowedError/, /^Failed to load resource/] // HTTP errors: reported with their URL below
const problems = []
const note = (vp, page, msg) => problems.push(`[${vp}] ${page}: ${msg}`)

async function audit(page, vp, step, touch) {
  const r = await page.evaluate((touch) => {
    const out = { overflow: document.documentElement.scrollWidth - window.innerWidth, small: [], tiny: [] }
    if (!touch) return out
    const visible = (el) => {
      const s = getComputedStyle(el)
      const b = el.getBoundingClientRect()
      return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight
    }
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el)) continue
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      if (own && parseFloat(getComputedStyle(el).fontSize) < 12) out.small.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 24)}" ${getComputedStyle(el).fontSize}`)
    }
    for (const el of document.querySelectorAll('button, a[href], [role="button"], label:has(input[type="radio"])')) {
      if (!visible(el) || el.closest('[data-allow-small]')) continue
      const b = el.getBoundingClientRect()
      if (b.width < 43.5 || b.height < 43.5) out.tiny.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}" ${Math.round(b.width)}×${Math.round(b.height)}`)
    }
    return out
  }, touch)
  if (r.overflow > 1) note(vp, step, `horizontal overflow ${r.overflow}px`)
  if (r.small.length) note(vp, step, `${r.small.length} text < 12px: ${r.small.slice(0, 4).join(' | ')}`)
  if (r.tiny.length) note(vp, step, `${r.tiny.length} targets < 44px: ${r.tiny.slice(0, 4).join(' | ')}`)
}

async function shot(page, vp, step, touch) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${vp}-${step}.png` })
  await audit(page, vp, step, touch)
}

const clickText = (page, re) => page.getByRole('button', { name: re }).first().click()

async function run() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true })
  for (const v of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: v.viewport, isMobile: !!v.touch, hasTouch: !!v.touch, deviceScaleFactor: v.touch ? 2 : 1 })
    const page = await ctx.newPage()
    let step = 'start'
    page.on('request', (req) => {
      const u = req.url()
      if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('ws://127.0.0.1')) note(v.name, step, `external request ${u}`)
    })
    page.on('console', (m) => { if (m.type() === 'error' && !IGNORED.some((re) => re.test(m.text()))) note(v.name, step, `console: ${m.text().slice(0, 160)}`) })
    page.on('pageerror', (e) => note(v.name, step, `page error: ${String(e).slice(0, 160)}`))
    page.on('response', (r) => { if (r.status() >= 400 && !IGNORED.some((re) => re.test(r.url()))) note(v.name, step, `${r.status()} ${r.url()}`) })
    try {
      await page.goto(BASE + '/', { waitUntil: 'networkidle' })
      await page.evaluate(() => { try { localStorage.clear() } catch { /* ignore */ } })
      await page.reload({ waitUntil: 'networkidle' })
      step = 'menu'; await shot(page, v.name, step, v.touch)

      await clickText(page, /single player/i)
      step = 'single-lobby'; await shot(page, v.name, step, v.touch)

      await page.goto(BASE + '/', { waitUntil: 'networkidle' })
      await clickText(page, /multiplayer/i)
      step = 'multi-lobby'; await shot(page, v.name, step, v.touch)

      await page.goto(BASE + '/', { waitUntil: 'networkidle' })
      await clickText(page, /single player/i)
      await page.route('**/api/single', async (route) => {
        const body = JSON.parse(route.request().postData() || '{}')
        await route.continue({ postData: JSON.stringify({ ...body, difficulty: 'easy', turnTimeout: 5 }) })
      })
      await clickText(page, /start game/i)
      await page.waitForTimeout(1800)
      step = 'waiting-room'; await shot(page, v.name, step, v.touch)
      await clickText(page, /start game/i)
      await page.waitForTimeout(2500)
      step = 'board'; await shot(page, v.name, step, v.touch)
      await page.waitForTimeout(6000)
      step = 'board-later'; await shot(page, v.name, step, v.touch)

      if (flags.has('--rest') && v.kind === 'desktop') {
        step = 'rest-popup'
        const box = await page.waitForSelector('[data-testid="rest-popup-anchored"]', { timeout: 90000 }).catch(() => null)
        if (box) { await page.waitForTimeout(350); await shot(page, v.name, step, v.touch) } else note(v.name, step, 'no rest popup within 90 s')
      }
      if (v.kind === 'desktop') {
        const toggle = page.locator('[data-skin-toggle]').first()
        if (await toggle.count()) {
          await toggle.click(); await page.waitForTimeout(1200)
          step = 'skin'; await shot(page, v.name, step, v.touch)
        }
      }
    } catch (e) {
      note(v.name, step, `flow failed: ${String(e).split('\n')[0]}`)
      await page.screenshot({ path: `${OUT}/${v.name}-${step}-FAILED.png` }).catch(() => {})
    }
    await ctx.close()
    console.log(`${v.name}: done`)
  }
  await browser.close()
  if (problems.length) {
    console.log(`\n${problems.length} problem(s):\n` + problems.map((p) => '  - ' + p).join('\n'))
    process.exit(1)
  }
  console.log('\nUI checks: clean')
}

run()
