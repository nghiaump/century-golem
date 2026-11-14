// Player avatars: /assets/images/avatar/<id>.webp, generated from a Super Mario Bros. sprite sheet
// (deploy/make-avatars.py). Ids 1..5 are also the AI defaults (avatar = player ID, max 5 players).
export const AVATAR_IDS = Array.from({ length: 15 }, (_, i) => String(i + 1))

// Bump AVATAR_VERSION whenever the avatar images change: Cloudflare/browsers cache /assets for 7 days,
// and the query string makes them fetch the new files.
const AVATAR_VERSION = 'smb1'

export function avatarSrc(id) {
  return `/assets/images/avatar/${id}.webp?v=${AVATAR_VERSION}`
}

// Avatar id to show for a player. Humans get the avatar they picked. The server gives AIs their player ID as
// avatar, which can clash with a human's pick, so AIs take the avatars no human picked, in seat order —
// deterministic, so every client shows the same thing.
export function resolveAvatarId(player, players = []) {
  if (!player) return AVATAR_IDS[0]
  if (!player.isAI) return String(player.avatar || AVATAR_IDS[0])
  const taken = new Set(players.filter((p) => !p.isAI).map((p) => String(p.avatar)))
  const free = AVATAR_IDS.filter((id) => !taken.has(id))
  const aiIndex = Math.max(0, players.filter((p) => p.isAI).findIndex((p) => p.id === player.id))
  return free[aiIndex % free.length] || AVATAR_IDS[0]
}
