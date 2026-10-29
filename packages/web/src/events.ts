type Listener = (payload: any) => void;

export class EventEmitter<Events extends Record<string, any>> {
    private listeners = new Map<string, Set<Listener>>();

    on<K extends keyof Events & string>(event: K, cb: (p: Events[K]) => void): () => void {
        let set = this.listeners.get(event);
        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }
        set.add(cb);
        return () => this.off(event, cb);
    }

    off<K extends keyof Events & string>(event: K, cb: (p: Events[K]) => void): void {
        this.listeners.get(event)?.delete(cb);
    }

    emit<K extends keyof Events & string>(event: K, payload: Events[K]): void {
        const set = this.listeners.get(event);
        if (!set) return;
        for (const cb of [...set]) {
            try {
                cb(payload);
            } catch (err) {
                console.error(err);
            }
        }
    }

    clear(): void {
        this.listeners.clear();
    }
}
