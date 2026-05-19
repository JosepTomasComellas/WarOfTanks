'use strict';

class SoundEngine {
  constructor() {
    this._ctx       = null;
    this._enabled   = true;
    this._lastBoom  = 0; // throttle explosions
  }

  _ctx_() {
    if (!this._ctx) {
      try {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch { this._enabled = false; }
    }
    return this._ctx;
  }

  toggle() { this._enabled = !this._enabled; return this._enabled; }

  // Short laser pew
  shoot() {
    if (!this._enabled) return;
    const ctx = this._ctx_(); if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.09);
  }

  // Noise burst explosion (throttled: max 1 per 120ms)
  explosion() {
    if (!this._enabled) return;
    const now = Date.now();
    if (now - this._lastBoom < 120) return;
    this._lastBoom = now;
    const ctx = this._ctx_(); if (!ctx) return;

    const len    = Math.floor(ctx.sampleRate * 0.35);
    const buf    = ctx.createBuffer(1, len, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1);

    const src    = ctx.createBufferSource();
    src.buffer   = buf;
    const filter = ctx.createBiquadFilter();
    filter.type  = 'lowpass';
    filter.frequency.value = 350;
    const gain   = ctx.createGain();
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.55, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + 0.4);
  }

  // Falling tone when MY tank dies
  death() {
    if (!this._enabled) return;
    const ctx = this._ctx_(); if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(550, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.9);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.95);
  }

  // Ascending fanfare for new round
  newRound() {
    if (!this._enabled) return;
    const ctx = this._ctx_(); if (!ctx) return;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square';
      const t = ctx.currentTime + i * 0.13;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}

const Sounds = new SoundEngine();
