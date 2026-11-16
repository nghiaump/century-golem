/**
 * Sound utility for game audio management
 * Handles playing sound effects with overlap prevention and mute functionality
 */
import { createLogger } from '../utils/logger'
const logger = createLogger('SoundManager');
class SoundManager {
  constructor() {
    this.sounds = {};
    this.currentlyPlaying = new Set();
    this.isMuted = false;
    
    // Initialize sound files
    this.soundFiles = {
      playCard: '/assets/sounds/play_card.mp3',
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
    
    // Prevent overlapping sounds unless explicitly allowed
    if (!allowOverlap && this.currentlyPlaying.has(soundName)) {
      logger.debug(`⏸️ Already playing: ${soundName}`);
      return;
    }
    
    logger.debug(`🔊 Playing sound: ${soundName} (overlap: ${allowOverlap})`);
    
    // Clone the audio for simultaneous plays if overlap is allowed
    const soundToPlay = allowOverlap ? audio.cloneNode() : audio;
    
    // Reset to beginning if not overlapping
    if (!allowOverlap) {
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
