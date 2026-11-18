import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { QueueState, Visitor, Priority, ServiceCounterQueue, VisualState } from "../types";
import { DOMAINS, DEMO_VISITORS } from "../config/domains";
import { NotificationManager } from "../utils/notifications";
import { APIClient } from "../utils/api";

const STORAGE_KEY = "queueflow-data";
const SPLIT_MODE_KEY = "queueflow-split-mode";
const BROADCAST_CHANNEL_NAME = "queueflow-sync";

interface QueueContextType {
  state: QueueState;
  isServerOnline: boolean;
  notificationManager: NotificationManager;
  registerVisitor: (serviceCounter: string, priority: Priority, name?: string) => Promise<Visitor | null>;
  leaveQueue: (visitorId: string) => Promise<void>;
  callNextVisitor: (serviceCounter: string) => Promise<Visitor | null>;
  completeVisitor: (visitorId: string) => Promise<void>;
  markNoShow: (visitorId: string) => Promise<void>;
  toggleCounterStatus: (serviceCounter: string) => Promise<void>;
  toggleSplitDemoMode: () => void;
  switchDomain: (domainId: string) => void;
  resetDemo: () => Promise<void>;
  getVisitorByToken: (token: string) => Visitor | null;
  calculateETA: (visitorId: string) => number;
  getVisualState: (visitor: Visitor) => VisualState;
  formatETA: (minutes: number) => string;
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

function generateToken(code: string, number: number): string {
  return `${code}-${number.toString().padStart(5, "0")}`;
}

function sortQueue(visitors: Visitor[]): Visitor[] {
  return [...visitors].sort((a, b) => {
    const priorityOrder = { Urgent: 0, Normal: 1 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.registeredAt - b.registeredAt;
  });
}

function recalculatePositions(queue: ServiceCounterQueue): void {
  const activeVisitors = queue.visitors.filter(v => v.status !== "completed" && v.status !== "no-show");
  const sorted = sortQueue(activeVisitors);
  sorted.forEach((visitor, index) => {
    visitor.position = index + 1;
  });
}

function initializeQueues(domainId: string): Record<string, ServiceCounterQueue> {
  const domain = DOMAINS.find((d) => d.id === domainId);
  if (!domain) return {};

  const queues: Record<string, ServiceCounterQueue> = {};
  domain.counters.forEach((counter) => {
    queues[counter.name] = {
      serviceCounter: counter.name,
      code: counter.code,
      avgServiceTime: counter.avgServiceTime,
      status: "open",
      visitors: [],
      nextTokenNumber: 1
    };
  });
  return queues;
}

function seedDemoData(queues: Record<string, ServiceCounterQueue>, domainId: string): void {
  const demoVisitors = DEMO_VISITORS[domainId as keyof typeof DEMO_VISITORS];
  if (!demoVisitors) return;

  let idCounter = 1;
  demoVisitors.forEach((demo, index) => {
    const queue = queues[demo.counter];
    if (!queue) return;

    const visitor: Visitor = {
      id: `demo-${idCounter++}`,
      token: generateToken(queue.code, queue.nextTokenNumber++),
      serviceCounter: demo.counter,
      counterCode: queue.code,
      priority: demo.priority,
      registeredAt: Date.now() - (5 - index) * 60000,
      status: index === 0 ? "called" : "waiting",
      position: 0
    };
    queue.visitors.push(visitor);
  });

  Object.values(queues).forEach(recalculatePositions);
}

export function QueueProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<QueueState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const splitMode = localStorage.getItem(SPLIT_MODE_KEY) === "true";
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...parsed, splitDemoMode: splitMode };
      } catch {}
    }

    const initialQueues = initializeQueues("bank");
    seedDemoData(initialQueues, "bank");
    
    return {
      queues: initialQueues,
      splitDemoMode: false,
      currentDomain: "bank"
    };
  });

  const [isServerOnline, setIsServerOnline] = useState(false);
  const [apiClient] = useState(() => new APIClient());
  const [notificationManager] = useState(() => new NotificationManager());
  const [broadcastChannel] = useState<BroadcastChannel | null>(() => {
    if (typeof BroadcastChannel !== "undefined") {
      return new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    }
    return null;
  });

  // Check server health on mount
  useEffect(() => {
    apiClient.checkHealth().then((online) => {
      setIsServerOnline(online);
      if (online) {
        // Load state from server
        apiClient.getState().then((serverState) => {
          if (serverState) {
            setState(serverState);
          }
        });
      }
    });
  }, [apiClient]);

  // Subscribe to SSE updates if server is online
  useEffect(() => {
    if (!isServerOnline) return;
    
    const unsubscribe = apiClient.subscribeToUpdates((newState) => {
      setState(newState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    });

    return unsubscribe;
  }, [isServerOnline, apiClient]);

  // BroadcastChannel sync (fallback when offline)
  useEffect(() => {
    if (!broadcastChannel || isServerOnline) return;

    const handleMessage = (event: MessageEvent<QueueState>) => {
      setState(event.data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(event.data));
    };

    broadcastChannel.onmessage = handleMessage;
    return () => {
      broadcastChannel.onmessage = null;
    };
  }, [broadcastChannel, isServerOnline]);

  // Save to localStorage (when offline)
  useEffect(() => {
    if (isServerOnline) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(SPLIT_MODE_KEY, String(state.splitDemoMode));
    broadcastChannel?.postMessage(state);
  }, [state, broadcastChannel, isServerOnline]);

  const registerVisitor = useCallback(async (serviceCounter: string, priority: Priority, name?: string): Promise<Visitor | null> => {
    if (isServerOnline) {
      const visitor = await apiClient.registerVisitor(serviceCounter, priority, name);
      if (visitor) {
        await notificationManager.requestPermission();
        return visitor;
      }
    }

    // Fallback to local - use setState with functional update
    return new Promise((resolve) => {
      setState(prevState => {
        const queue = prevState.queues[serviceCounter];
        if (!queue) {
          resolve(null);
          return prevState;
        }

        const visitor: Visitor = {
          id: crypto.randomUUID(),
          token: generateToken(queue.code, queue.nextTokenNumber),
          serviceCounter,
          counterCode: queue.code,
          priority,
          registeredAt: Date.now(),
          status: "waiting",
          position: 0
        };

        const newQueues = { ...prevState.queues };
        newQueues[serviceCounter] = {
          ...queue,
          visitors: [...queue.visitors, visitor],
          nextTokenNumber: queue.nextTokenNumber + 1
        };
        recalculatePositions(newQueues[serviceCounter]);

        notificationManager.requestPermission();
        resolve(visitor);
        return { ...prevState, queues: newQueues };
      });
    });
  }, [isServerOnline, apiClient, notificationManager]);

  const callNextVisitor = useCallback(async (serviceCounter: string): Promise<Visitor | null> => {
    if (isServerOnline) {
      const visitor = await apiClient.callNext(serviceCounter);
      if (visitor) {
        notificationManager.notifyCalled(visitor.token);
      }
      return visitor;
    }

    // Fallback to local - use setState with functional update
    return new Promise((resolve) => {
      setState(prevState => {
        const queue = prevState.queues[serviceCounter];
        if (!queue || queue.status === "paused") {
          resolve(null);
          return prevState;
        }

        // Check if someone is already being served
        const calledVisitor = queue.visitors.find(v => v.status === "called");
        if (calledVisitor) {
          resolve(null);
          return prevState;
        }

        const activeVisitors = queue.visitors.filter(v => v.status !== "completed" && v.status !== "no-show");
        const sorted = sortQueue(activeVisitors);
        const nextVisitor = sorted.find((v) => v.status === "waiting" || v.status === "approaching");
        if (!nextVisitor) {
          resolve(null);
          return prevState;
        }

        const newQueues = { ...prevState.queues };
        const visitorIndex = newQueues[serviceCounter].visitors.findIndex((v) => v.id === nextVisitor.id);
        newQueues[serviceCounter] = {
          ...newQueues[serviceCounter],
          visitors: [...newQueues[serviceCounter].visitors]
        };
        newQueues[serviceCounter].visitors[visitorIndex] = {
          ...newQueues[serviceCounter].visitors[visitorIndex],
          status: "called"
        };

        notificationManager.notifyCalled(nextVisitor.token);
        resolve(nextVisitor);
        return { ...prevState, queues: newQueues };
      });
    });
  }, [isServerOnline, apiClient, notificationManager]);

  const completeVisitor = useCallback(async (visitorId: string): Promise<void> => {
    if (isServerOnline) {
      await apiClient.complete(visitorId);
      return;
    }

    // Fallback to local - use setState with functional update
    setState(prevState => {
      const newQueues = { ...prevState.queues };
      for (const queueName in newQueues) {
        const queue = newQueues[queueName];
        const index = queue.visitors.findIndex((v) => v.id === visitorId);
        if (index !== -1) {
          newQueues[queueName] = {
            ...queue,
            visitors: [...queue.visitors]
          };
          // Mark as completed instead of removing
          newQueues[queueName].visitors[index] = {
            ...newQueues[queueName].visitors[index],
            status: "completed"
          };
          recalculatePositions(newQueues[queueName]);
          
          // Check for approaching notifications
          newQueues[queueName].visitors.forEach((v, idx) => {
            if (v.position <= 2 && v.status === "waiting") {
              newQueues[queueName].visitors[idx] = {
                ...v,
                status: "approaching"
              };
              notificationManager.notifyApproaching(v.token, v.position);
            }
          });
          break;
        }
      }
      return { ...prevState, queues: newQueues };
    });
  }, [isServerOnline, apiClient, notificationManager]);

  const markNoShow = useCallback(async (visitorId: string): Promise<void> => {
    if (isServerOnline) {
      await apiClient.markNoShow(visitorId);
      return;
    }

    // Fallback to local - use setState with functional update
    setState(prevState => {
      const newQueues = { ...prevState.queues };
      for (const queueName in newQueues) {
        const queue = newQueues[queueName];
        const index = queue.visitors.findIndex((v) => v.id === visitorId);
        if (index !== -1) {
          newQueues[queueName] = {
            ...queue,
            visitors: [...queue.visitors]
          };
          // Mark as no-show instead of removing
          newQueues[queueName].visitors[index] = {
            ...newQueues[queueName].visitors[index],
            status: "no-show"
          };
          recalculatePositions(newQueues[queueName]);
          break;
        }
      }
      return { ...prevState, queues: newQueues };
    });
  }, [isServerOnline, apiClient]);

  const toggleCounterStatus = useCallback(async (serviceCounter: string): Promise<void> => {
    if (isServerOnline) {
      await apiClient.toggleCounter(serviceCounter);
      return;
    }

    // Fallback to local - use setState with functional update
    setState(prevState => {
      const newQueues = { ...prevState.queues };
      if (newQueues[serviceCounter]) {
        newQueues[serviceCounter] = {
          ...newQueues[serviceCounter],
          status: newQueues[serviceCounter].status === "open" ? "paused" : "open"
        };
      }
      return { ...prevState, queues: newQueues };
    });
  }, [isServerOnline, apiClient]);

  const leaveQueue = useCallback(async (visitorId: string): Promise<void> => {
    if (isServerOnline) {
      await apiClient.leaveQueue(visitorId);
      return;
    }
    await completeVisitor(visitorId);
  }, [isServerOnline, apiClient, completeVisitor]);

  const toggleSplitDemoMode = useCallback(() => {
    setState((prev) => ({ ...prev, splitDemoMode: !prev.splitDemoMode }));
  }, []);

  const switchDomain = useCallback((domainId: string) => {
    setState(prevState => {
      const newQueues = initializeQueues(domainId);
      seedDemoData(newQueues, domainId);
      return { ...prevState, queues: newQueues, currentDomain: domainId };
    });
  }, []);

  const resetDemo = useCallback(async (): Promise<void> => {
    if (isServerOnline) {
      await apiClient.resetDemo();
      return;
    }

    setState(prevState => {
      const newQueues = initializeQueues(prevState.currentDomain);
      seedDemoData(newQueues, prevState.currentDomain);
      return { ...prevState, queues: newQueues };
    });
  }, [isServerOnline, apiClient]);

  const getVisitorByToken = useCallback((token: string): Visitor | null => {
    for (const queue of Object.values(state.queues)) {
      const visitor = queue.visitors.find((v) => v.token === token);
      if (visitor) return visitor;
    }
    return null;
  }, [state.queues]);

  const calculateETA = useCallback((visitorId: string): number => {
    for (const queue of Object.values(state.queues)) {
      const visitor = queue.visitors.find((v) => v.id === visitorId);
      if (visitor) {
        if (visitor.status === "called") return 0;
        const peopleAhead = visitor.position - 1;
        return Math.max(0, peopleAhead * queue.avgServiceTime);
      }
    }
    return 0;
  }, [state.queues]);

  const getVisualState = useCallback((visitor: Visitor): VisualState => {
    if (visitor.status === "called") {
      return {
        state: "called",
        color: "emerald-500",
        message: "Please proceed to service counter"
      };
    }
    if (visitor.position <= 2) {
      return {
        state: "approaching",
        color: "amber-500",
        message: `Your turn is approaching (${visitor.position} in queue)`
      };
    }
    return {
      state: "waiting",
      color: "slate-600",
      message: `Position in queue: ${visitor.position}`
    };
  }, []);

  const formatETA = useCallback((minutes: number): string => {
    if (minutes === 0) return "Your turn!";
    const mins = Math.round(minutes);
    return mins === 1 ? `${mins} min` : `${mins} mins`;
  }, []);

  const value: QueueContextType = {
    state,
    isServerOnline,
    notificationManager,
    registerVisitor,
    leaveQueue,
    callNextVisitor,
    completeVisitor,
    markNoShow,
    toggleCounterStatus,
    toggleSplitDemoMode,
    switchDomain,
    resetDemo,
    getVisitorByToken,
    calculateETA,
    getVisualState,
    formatETA
  };

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue() {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error("useQueue must be used within QueueProvider");
  }
  return context;
}