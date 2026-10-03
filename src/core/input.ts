// Keyboard / mouse / pointer-lock input.
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  locked = false;
  /** When false, gameplay keys are ignored (UI owns input). */
  gameplayEnabled = true;
  private canvas: HTMLElement;
  onLockChange: ((locked: boolean) => void) | null = null;

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => this.down.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // Guard against browser spikes when lock engages.
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this.down.clear();
      this.onLockChange?.(this.locked);
    });
  }

  requestLock(): void {
    if (document.pointerLockElement === this.canvas) return;
    try {
      const p = (this.canvas as any).requestPointerLock?.();
      if (p && typeof p.catch === 'function') p.catch(() => undefined);
    } catch {
      /* ignored: some environments refuse pointer lock */
    }
  }

  releaseLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(code: string): boolean {
    return this.gameplayEnabled && this.down.has(code);
  }

  /** True once per physical press. Consumes the press. */
  consume(code: string): boolean {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  /** Programmatic key injection (QA automation). */
  inject(code: string, isDown: boolean): void {
    if (isDown) {
      this.down.add(code);
      this.pressed.add(code);
    } else this.down.delete(code);
  }

  endFrame(): void {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
