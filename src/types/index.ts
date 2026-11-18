// Core type definitions for QueueFlow
export type Priority = "Normal" | "Urgent";
export type VisitorStatus = "waiting" | "approaching" | "called" | "completed" | "no-show";
export type CounterStatus = "open" | "paused";

export interface ServiceCounter {
  name: string;
  code: string;
  avgServiceTime: number; // minutes
}

export interface Visitor {
  id: string;
  token: string;
  serviceCounter: string;
  counterCode: string;
  priority: Priority;
  registeredAt: number;
  status: VisitorStatus;
  position: number;
}

export interface ServiceCounterQueue {
  serviceCounter: string;
  code: string;
  avgServiceTime: number;
  status: CounterStatus;
  visitors: Visitor[];
  nextTokenNumber: number;
}

export interface QueueState {
  queues: Record<string, ServiceCounterQueue>;
  splitDemoMode: boolean;
  currentDomain: string;
}

export interface Domain {
  id: string;
  name: string;
  icon: string;
  counters: ServiceCounter[];
}

export interface VisualState {
  state: "waiting" | "approaching" | "called";
  color: string;
  message: string;
}
