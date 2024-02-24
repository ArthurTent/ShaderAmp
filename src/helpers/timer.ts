// A modified version of a generic timer
// Source: https://www.dhiwise.com/post/simplify-event-timing-and-scheduling-with-typescript-timer
export class ClassTimer {
    private timerId: number | null = null;
    private duration: number;
    private variation: number;
    private callback?: () => void = undefined;

    constructor(duration: number, variation: number, callback: () => void) {
      this.duration = duration;
      this.variation = variation;
      this.callback = callback;
    }
  
    start(): void {
      if (this.timerId === null) {
        this.scheduleTimeout();
      }
    }
  
    loopingTimeout(): void {
      this.invokeCallback();
      this.scheduleTimeout();
    }

    scheduleTimeout(): void {
      this.timerId = window.setTimeout(() => this.loopingTimeout(), this.getRandomDuration() * 1000);
    }

    getRandomDuration(): number {
      const randNumber = this.duration - (this.variation / 2) + this.variation * Math.random();
      return Math.max(0, randNumber);
    }

    stop(): void {
      if (this.timerId !== null) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
    }
    
    setDuration(duration: number, variation: number): void {
        this.duration = duration;
        this.variation = variation;
        if (this.timerId !== null) {
            this.stop();
            this.start();
        }
    }

    invokeCallback(): void {
        try {
            this.callback?.();
        } catch (error) {
            console.error('An error occurred in the timer callback:', error);
        }
    }
}