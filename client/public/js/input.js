'use strict';

class InputHandler {
  constructor() {
    this.keys = 0;
    const map = {
      ArrowUp: 0x01, KeyW: 0x01,
      ArrowDown: 0x02, KeyS: 0x02,
      ArrowLeft: 0x04, KeyA: 0x04,
      ArrowRight: 0x08, KeyD: 0x08,
      Space: 0x10,
    };
    this._down = (e) => { const b = map[e.code]; if (b) { this.keys |= b; e.preventDefault(); } };
    this._up   = (e) => { const b = map[e.code]; if (b) { this.keys &= ~b; } };
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup',   this._up);
  }
  destroy() {
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup',   this._up);
  }
}
