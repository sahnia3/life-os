import type { StreamEvent } from "./types";

type Listener = (evt: StreamEvent) => void;

declare global {
   
  var __agentOsBus: EventBus | undefined;
}

class EventBus {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(evt: StreamEvent): void {
    for (const l of this.listeners) {
      try {
        l(evt);
      } catch (e) {
        console.error("[agent-os] listener error", e);
      }
    }
  }

  size(): number {
    return this.listeners.size;
  }
}

export function getBus(): EventBus {
  if (!globalThis.__agentOsBus) globalThis.__agentOsBus = new EventBus();
  return globalThis.__agentOsBus;
}
