/**
 * Sound utility for game audio management
 * Handles playing sound effects with overlap prevention and mute functionality
 */
import { createLogger } from '../utils/logger'
const logger = createLogger('SoundManager');

/**
 * A soft card slap — "xoạch" (a short swish) then "bạch" (the card hitting the table, with a little thump) —
 * synthesised as samples: about 0.2 s, deterministic, nothing to download.
 */
export function cardSlapSamples(rate = 22050) {
  const n = Math.round(rate * 0.2);
  const out = new Float32Array(n);
  let seed = 7;
  const noise = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 2147483648 - 1; };
  // band-pass biquad (RBJ, 0 dB peak)
  const bandPass = (f0, q) => {
    const w = (2 * Math.PI * f0) / rate;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    return { b0: alpha / a0, b2: -alpha / a0, a1: (-2 * Math.cos(w)) / a0, a2: (1 - alpha) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
  };
  const run = (f, x) => {
    const y = f.b0 * x + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
    f.x2 = f.x1; f.x1 = x; f.y2 = f.y1; f.y1 = y;
    return y;
  };
  const swish = bandPass(4200, 0.7);
  const slap = bandPass(1700, 1.0);
  const hit = 0.04; // the swish leads into the slap
  let phase = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const nz = noise();
    let v = 0;
    if (t < hit) {
      v += run(swish, nz) * Math.sin((Math.PI * t) / hit) ** 2 * 0.5;
    } else {
      const d = t - hit;
      v += run(slap, nz) * Math.min(1, d / 0.0012) * Math.exp(-d / 0.02) * 2.4;
      phase += (2 * Math.PI * (150 - 70 * Math.min(1, d / 0.05))) / rate;
      v += Math.sin(phase) * Math.exp(-d / 0.028) * 0.45;
    }
    out[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  const gain = peak > 0 ? 0.6 / peak : 1; // soft: peaks at 60 %
  for (let i = 0; i < n; i++) out[i] *= gain;
  return out;
}

/** 16-bit mono WAV bytes for `samples` (-1…1). */
export function wavBytes(samples, rate = 22050) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, text) => { for (let i = 0; i < text.length; i++) v.setUint8(o + i, text.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
  return buf;
}

// The slap as a playable URL (an <audio> like the other sounds, so it is unlocked the same way on phones)
function cardSlapUrl() {
  try {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof Blob === 'undefined') return null;
    return URL.createObjectURL(new Blob([wavBytes(cardSlapSamples())], { type: 'audio/wav' }));
  } catch {
    return null;
  }
}
class SoundManager {
  constructor() {
    this.sounds = {};
    this.currentlyPlaying = new Set();
    this.isMuted = false;
    
    // Initialize sound files
    this.soundFiles = {
      playCard: cardSlapUrl() || '/assets/sounds/play_card.mp3', // anyone plays a card: a soft slap
      acquireMerchant: '/assets/sounds/acquire_merchant.mp3',
      claimPointCard: '/assets/sounds/claim_point_card.mp3',
      rest: '/assets/sounds/rest.mp3',
      gameOver: '/assets/sounds/game_over.mp3',
      myTurn: '/assets/sounds/my_turn.mp3',
      nearlyEnd: '/assets/sounds/nearly_end.mp3',
    };
    
    // Load mute state from localStorage
    const savedMuteState = localStorage.getItem('gameSoundsMuted');
    this.isMuted = savedMuteState === 'true';
    
    // Preload all sounds
    this.preloadSounds();
    this.installUnlock();
  }

  /**
   * Phones — iOS Safari above all — only let a page start a sound during a tap: a sound started later by
   * a game update ("your turn", an opponent's rest…) is refused, unless that very <audio> element was
   * played once during a tap. So on the first taps every sound is started muted and stopped again, and the
   * Web Audio context (victory fanfare) is created and resumed; after that the game can play them any time.
   */
  installUnlock() {
    if (typeof document === 'undefined') return;
    const events = ['touchend', 'pointerup', 'click', 'keydown'];
    const unlock = () => {
      Object.values(this.sounds).forEach((audio) => {
        if (audio._unlocked || audio._priming) return;
        if (!audio.paused) { audio._unlocked = true; return; }
        audio._priming = true;
        audio.muted = true;
        const done = (ok) => {
          audio._priming = false;
          if (ok) audio._unlocked = true;
          // stop the silent run, unless a real play took the element over meanwhile (it unmutes it)
          if (audio.muted) {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
          }
        };
        let started;
        try { started = audio.play(); } catch { started = null; }
        if (started && typeof started.then === 'function') started.then(() => done(true), () => done(false));
        else done(true);
      });
      const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (Ctx) {
        try {
          this.audioCtx = this.audioCtx || new Ctx();
          if (this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
        } catch { /* no Web Audio: the fanfare falls back to the game-over sound */ }
      }
      if (Object.values(this.sounds).every((a) => a._unlocked)) {
        events.forEach((e) => document.removeEventListener(e, unlock, true));
        logger.debug('🔓 Sounds unlocked');
      }
    };
    events.forEach((e) => document.addEventListener(e, unlock, true));
  }

  /** Is this element sounding right now? (Not a flag kept by events: an interrupted sound never sends 'ended'.) */
  static busy(audio) {
    return !!audio && !audio.paused && !audio.ended && !audio.muted;
  }
  
  preloadSounds() {
    Object.entries(this.soundFiles).forEach(([key, path]) => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.addEventListener('error', (e) => {
        logger.warn(`Failed to load sound: ${path}`, e);
      });
      this.sounds[key] = audio;
    });
  }
  
  /**
   * Play a sound effect
   * @param {string} soundName - Name of the sound to play
   * @param {boolean} allowOverlap - Whether to allow this sound to overlap with others
   */
  play(soundName, allowOverlap = false) {
    if (this.isMuted) {
      logger.debug(`🔇 Sound muted: ${soundName}`);
      return;
    }
    
    const audio = this.sounds[soundName];
    if (!audio) {
      logger.warn(`❌ Sound not found: ${soundName}`);
      return;
    }
    
    // Prevent overlapping sounds unless explicitly allowed. Asks the element itself whether it is playing:
    // a sound cut off (screen locked, app switched, a call) never fires 'ended', and the old bookkeeping
    // then skipped that sound for the rest of the game — e.g. no more "your turn" chime on phones.
    const busy = SoundManager.busy(audio);
    if (!allowOverlap && busy) {
      logger.debug(`⏸️ Already playing: ${soundName}`);
      return;
    }
    
    logger.debug(`🔊 Playing sound: ${soundName} (overlap: ${allowOverlap})`);
    
    // Overlapping play: a copy only while the original is busy (a fresh copy is not unlocked on iOS)
    const soundToPlay = allowOverlap && busy ? audio.cloneNode() : audio;
    if (soundToPlay === audio) {
      audio.muted = false; // take over from a silent unlock run, if one is going
      soundToPlay.currentTime = 0;
    }
    
    // Track playing state
    this.currentlyPlaying.add(soundName);
    
    // Play the sound
    const playPromise = soundToPlay.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          logger.debug(`✅ Sound started: ${soundName}`);
        })
        .catch((error) => {
          logger.error(`❌ Error playing sound ${soundName}:`, error);
          this.currentlyPlaying.delete(soundName);
        });
    }
    
    // Remove from playing set when finished
    soundToPlay.addEventListener('ended', () => {
      this.currentlyPlaying.delete(soundName);
      logger.debug(`🏁 Sound ended: ${soundName}`);
    }, { once: true });
  }
  
  /**
   * Toggle mute state
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('gameSoundsMuted', this.isMuted.toString());
    
    // Stop all currently playing sounds when muting
    if (this.isMuted) {
      Object.values(this.sounds).forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
      this.currentlyPlaying.clear();
    }
    
    return this.isMuted;
  }
  
  /**
   * Set mute state
   */
  setMuted(muted) {
    this.isMuted = muted;
    localStorage.setItem('gameSoundsMuted', this.isMuted.toString());
    
    if (this.isMuted) {
      Object.values(this.sounds).forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
      this.currentlyPlaying.clear();
    }
  }
  
  /**
   * Get current mute state
   */
  getMuted() {
    return this.isMuted;
  }
  
  /**
   * Victory fanfare for the player who won, synthesised with Web Audio (no file to download): a rising
   * G–C–E–G call, then a held C-major chord with bell sparkles (~2.5 s). Falls back to the game-over
   * sound where Web Audio is missing. Respects mute.
   */
  playVictory() {
    if (this.isMuted) return false;
    const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!Ctx) {
      this.play('gameOver', true);
      return false;
    }
    try {
      this.audioCtx = this.audioCtx || new Ctx();
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      const t0 = ctx.currentTime + 0.05;
      const master = ctx.createGain();
      master.gain.value = 0.2;
      master.connect(ctx.destination);
      // a little room: feedback echo
      const echo = ctx.createDelay();
      echo.delayTime.value = 0.17;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.25;
      echo.connect(feedback);
      feedback.connect(echo);
      echo.connect(master);
      const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
      const envelope = (g, at, peak, dur, attack = 0.015) => {
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(peak, t0 + at + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      };
      // horn-like voice: triangle + a soft square an octave lower, lowpassed
      const horn = (midi, at, dur, vol) => {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, t0 + at);
        filter.frequency.linearRampToValueAtTime(2600, t0 + at + 0.1);
        const g = ctx.createGain();
        envelope(g, at, vol, dur, 0.03);
        filter.connect(g);
        g.connect(master);
        g.connect(echo);
        [['triangle', 1, 1], ['square', 0.5, 0.18]].forEach(([type, mult, amp]) => {
          const o = ctx.createOscillator();
          const og = ctx.createGain();
          o.type = type;
          o.frequency.value = hz(midi) * mult;
          og.gain.value = amp;
          o.connect(og);
          og.connect(filter);
          o.start(t0 + at);
          o.stop(t0 + at + dur + 0.05);
        });
      };
      // bell: a few inharmonic sine partials with a fast decay
      const bell = (midi, at, dur, vol) => {
        [[1, 1], [2.01, 0.4], [3.03, 0.2], [4.2, 0.08]].forEach(([mult, amp]) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = hz(midi) * mult;
          envelope(g, at, vol * amp, dur, 0.008);
          o.connect(g);
          g.connect(master);
          g.connect(echo);
          o.start(t0 + at);
          o.stop(t0 + at + dur + 0.05);
        });
      };
      [[67, 0], [72, 0.15], [76, 0.3]].forEach(([m, at]) => horn(m, at, 0.2, 0.5));
      horn(79, 0.45, 0.55, 0.55);
      [60, 64, 67, 72].forEach((m) => horn(m, 1.0, 1.5, 0.26));
      bell(48, 1.0, 1.8, 0.5);
      [84, 88, 91, 96, 91, 100].forEach((m, i) => bell(m, 1.08 + i * 0.13, 0.9, 0.3));
      return true;
    } catch (error) {
      logger.warn('Victory fanfare failed, playing the game-over sound', error);
      this.play('gameOver', true);
      return false;
    }
  }

  /**
   * Stop all sounds
   */
  stopAll() {
    Object.values(this.sounds).forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.currentlyPlaying.clear();
  }
}

// Create singleton instance
const soundManager = new SoundManager();

export default soundManager;

// Export individual sound functions for convenience
export const playCardSound = () => soundManager.play('playCard');
export const playAcquireMerchantSound = () => soundManager.play('acquireMerchant');
export const playClaimPointCardSound = () => soundManager.play('claimPointCard');
export const playRestSound = () => soundManager.play('rest');
export const playGameOverSound = () => soundManager.play('gameOver', true);
export const playMyTurnSound = () => soundManager.play('myTurn');
export const playNearlyEndSound = () => soundManager.play('nearlyEnd', true);
