// A modified version of a generic timer
// Source: https://www.dhiwise.com/post/simplify-event-timing-and-scheduling-with-typescript-timer
export class ClassTimer {
    private timerId: number | null = null;
    private duration: number;
    private callback?: () => void = undefined;

    constructor(duration: number, callback: () => void) {
      this.duration = duration;
      this.callback = callback;
    }
  
    start(): void {
      if (this.timerId === null) {
        this.timerId = window.setInterval(() => {
            this.invokeCallback();
        }, this.duration);
      }
    }
  
    stop(): void {
      if (this.timerId !== null) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    }
    
    setDuration(duration: number): void {
        this.duration = duration;
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