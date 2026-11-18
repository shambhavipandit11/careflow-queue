import type { QueueState, Visitor, Priority } from "../types";

const API_BASE = "http://localhost:3001/api";

export class APIClient {
  private isOnline: boolean = true;
  private eventSource: EventSource | null = null;

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/state`, { method: "HEAD" });
      this.isOnline = res.ok;
      return this.isOnline;
    } catch {
      this.isOnline = false;
      return false;
    }
  }

  async getState(): Promise<QueueState | null> {
    try {
      const res = await fetch(`${API_BASE}/state`);
      if (!res.ok) throw new Error("Failed to fetch state");
      return await res.json();
    } catch {
      return null;
    }
  }

  async registerVisitor(serviceCounter: string, priority: Priority, name?: string): Promise<Visitor | null> {
    try {
      const res = await fetch(`${API_BASE}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceCounter, priority, name })
      });
      if (!res.ok) throw new Error("Failed to register");
      return await res.json();
    } catch {
      return null;
    }
  }

  async leaveQueue(visitorId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async callNext(serviceCounter: string): Promise<Visitor | null> {
    try {
      const res = await fetch(`${API_BASE}/call-next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceCounter })
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async complete(visitorId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async markNoShow(visitorId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/no-show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async toggleCounter(serviceCounter: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/toggle-counter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceCounter })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async resetDemo(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/reset`, { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  }

  subscribeToUpdates(onUpdate: (state: QueueState) => void): () => void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.eventSource = new EventSource(`${API_BASE}/stream`);
    
    this.eventSource.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data);
        onUpdate(state);
      } catch (err) {
        console.error("Failed to parse SSE data:", err);
      }
    };

    this.eventSource.onerror = () => {
      console.warn("SSE connection error, will retry");
    };

    return () => {
      this.eventSource?.close();
      this.eventSource = null;
    };
  }

  isServerOnline(): boolean {
    return this.isOnline;
  }
}
