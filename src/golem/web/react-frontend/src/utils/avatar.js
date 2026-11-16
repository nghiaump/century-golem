import { apiUrl } from './api'

// Player avatars: /assets/images/avatar/<id>.svg — 24 original golems drawn by deploy/make-golem-avatars.py
// (12 golems, then one variant of each). Names and count must match `avatarNames` in
// internal/session/ai_turns.go: the server picks random AI avatars and names the AI after its golem.
export const AVATAR_NAMES = [
  'Basalt',
  'Mossback',
  'Rime',
  'Cinder',
  'Rivet',
  'Dune',
  'Quartz',
  'Terra',
  'Onyx',
  'Rootling',
  'Reef',
  'Nimbus',
  'Granite',
  'Fernhide',
  'Glacier',
  'Magma',
  'Anvil',
  'Mesa',
  'Amethyst',
  'Kiln',
  'Jet',
  'Thornbark',
  'Coralline',
  'Squall',
]
export const AVATAR_IDS = AVATAR_NAMES.map((_, i) => String(i + 1))
export const avatarName = (id) => AVATAR_NAMES[Number(id) - 1] || ''

// Bump AVATAR_VERSION whenever the avatar images change: Cloudflare/browsers cache /assets for 7 days,
// and the query string makes them fetch the new files.
const AVATAR_VERSION = 'golem1'

// A player's own picture: "u_<16 hex>" (uploaded for the current room, kept by the server only while a
// room uses it — internal/avatars). Anything else unknown falls back to the first golem.
const CUSTOM_AVATAR = /^u_([0-9a-f]{16})$/
export const isCustomAvatar = (id) => CUSTOM_AVATAR.test(String(id || ''))

export function avatarSrc(id) {
  const custom = CUSTOM_AVATAR.exec(String(id || ''))
  if (custom) return apiUrl(`/api/avatars/${custom[1]}.jpg`)
  const known = AVATAR_IDS.includes(String(id)) ? String(id) : AVATAR_IDS[0]
  return `/assets/images/avatar/${known}.svg?v=${AVATAR_VERSION}`
}

// Avatar id to show for a player. Humans get the avatar they picked. The server gives AIs their player ID as
// avatar, which can clash with a human's pick, so AIs take the avatars no human picked, in seat order —
// deterministic, so every client shows the same thing.
export function resolveAvatarId(player, players = []) {
  if (!player) return AVATAR_IDS[0]
  if (!player.isAI) return String(player.avatar || AVATAR_IDS[0])
  // Current servers pick a random avatar for every AI (distinct, never a human's pick) and flag it.
  if (player.aiAvatar && AVATAR_IDS.includes(String(player.avatar))) return String(player.avatar)
  // Older servers sent avatar = player ID: fall back to the deterministic seat-order assignment.
  const taken = new Set(players.filter((p) => !p.isAI).map((p) => String(p.avatar)))
  const free = AVATAR_IDS.filter((id) => !taken.has(id))
  const aiIndex = typeof player.aiIndex === 'number'
    ? player.aiIndex
    : Math.max(0, players.filter((p) => p.isAI).findIndex((p) => p.id === player.id))
  return free[aiIndex % free.length] || AVATAR_IDS[0]
}
