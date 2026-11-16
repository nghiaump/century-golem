// The player's own avatar picture, handled in the browser: pick (≤ 5 MB) → crop → 256×256 JPEG
// (≈ 20–40 KB) kept in this browser, uploaded to the server when a game is started or joined. The
// server only keeps it while a room uses it (internal/avatars), so every start uploads it again
// (same picture → same value, cheap).
import { apiFetch } from './api'
import { isCustomAvatar } from './avatar'

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const OUTPUT_SIZE = 256
export const CUSTOM = 'custom' // lobby selection meaning "my own picture"
const MAX_PIXELS = 40e6 // refuse absurd dimensions before decoding into a canvas
const STORAGE_KEY = 'golem.customAvatar'

/** Load a picked file as an <img>; rejects with a message the lobby can show. */
export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected'))
    if (!/^image\//.test(file.type)) return reject(new Error('Please choose an image (JPEG, PNG, WebP…)'))
    if (file.size > MAX_FILE_BYTES) return reject(new Error('The image is larger than 5 MB'))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth * img.naturalHeight > MAX_PIXELS) {
        URL.revokeObjectURL(url)
        reject(new Error('The image has too many pixels'))
      } else {
        resolve({ img, url })
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This file could not be read as an image'))
    }
    img.src = url
  })
}

/**
 * Draw the square `crop` ({x, y, size} in image pixels) of `img` to an OUTPUT_SIZE JPEG data URL.
 * Large photos are halved step by step first, which keeps the small result sharp.
 */
export function renderCrop(img, crop, size = OUTPUT_SIZE) {
  let source = img
  let sx = crop.x
  let sy = crop.y
  let side = crop.size
  while (side > size * 2) {
    const half = Math.ceil(side / 2)
    const c = document.createElement('canvas')
    c.width = half
    c.height = half
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, sx, sy, side, side, 0, 0, half, half)
    source = c
    sx = 0
    sy = 0
    side = half
  }
  const out = document.createElement('canvas')
  out.width = size
  out.height = size
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#12131c' // transparent areas → page colour (JPEG has no alpha)
  ctx.fillRect(0, 0, size, size)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size)
  return out.toDataURL('image/jpeg', 0.88)
}

export function loadStoredPicture() {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v && v.startsWith('data:image/jpeg') ? v : null
  } catch {
    return null
  }
}

export function storePicture(dataUrl) {
  try {
    if (dataUrl) window.localStorage.setItem(STORAGE_KEY, dataUrl)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage blocked: the picture still works for this page
  }
}

/** Upload the stored picture; resolves to the avatar value ("u_…") to join with. */
export async function uploadPicture(dataUrl) {
  if (!dataUrl) throw new Error('No picture to upload')
  const blob = await (await fetch(dataUrl)).blob()
  const res = await apiFetch('/api/avatars', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !isCustomAvatar(data.avatar)) throw new Error(data.error || `Upload failed (HTTP ${res.status})`)
  return data.avatar
}

/**
 * The avatar value to send when starting/joining: built-in ids as they are; CUSTOM (or an earlier
 * "u_…" value) uploads the stored picture again. Falls back to `fallback` if there is no picture.
 */
export async function resolveAvatar(choice, fallback = '4') {
  if (choice !== CUSTOM && !isCustomAvatar(choice)) return String(choice || fallback)
  const picture = loadStoredPicture()
  if (!picture) return isCustomAvatar(choice) ? choice : fallback
  return uploadPicture(picture)
}
