# Design Document

## Introduction

QueueFlow is a frontend-only Smart Virtual Queue Management System for general-purpose service counter operations. The system provides real-time queue management with priority-aware FIFO processing, cross-tab synchronization, and separate interfaces for visitors and service providers. Built with React, TypeScript, and Tailwind CSS v4, it uses browser-native APIs (localStorage and BroadcastChannel) for state management and synchronization. The system includes estimated wait time calculations, multi-modal notifications (synthesized audio chime, browser notifications, and toast notifications), split-screen demonstration mode, no-show management, and per-counter status controls (open/pause).

## Overview

QueueFlow manages visitor queues across three service counters: General Service Desk (G, 5 min avg), Express Counter (E, 3 min avg), and Priority & Support Desk (P, 8 min avg). The system provides real-time queue management with priority-aware FIFO processing, cross-tab synchronization via BroadcastChannel, and separate interfaces (User_View for visitors, Provider_Console for service providers). Built with React, TypeScript, and Tailwind CSS v4, it uses browser-native APIs for state management and synchronization without requiring a backend server.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Browser Environment                              │
│                                                                          │
│  ┌────────────────┐    ┌────────────────────┐    ┌──────────────────┐ │
│  │  User_View     │    │ Provider_Console   │    │ Split_Demo_Mode  │ │
│  │  (Visitor UI)  │    │ (Provider UI)      │    │ (Desktop ≥1024px)│ │
│  └────────┬───────┘    └────────┬───────────┘    └────────┬─────────┘ │
│           │                     │                          │            │
│           └─────────────────────┴──────────────────────────┘            │
│                                 │                                       │
│                     ┌───────────▼────────────┐                         │
│                     │   QueueContext         │                         │
│                     │   (React Context)      │                         │
│                     └───────────┬────────────┘                         │
│                                 │                                       │
│                     ┌───────────▼────────────┐                         │
│                     │  Queue State Manager   │                         │
│                     │  - Priority-FIFO Logic │                         │
│                     │  - Token Generation    │                         │
│                     │  - ETA Calculation     │                         │
│                     │  - Counter Status      │                         │
│                     │  - No-Show Management  │                         │
│                     └───┬────────────────┬───┘                         │
│                         │                │                              │
│             ┌───────────▼──────┐  ┌──────▼────────────┐               │
│             │  localStorage     │  │ BroadcastChannel  │               │
│             │  (Persistence)    │  │ "queueflow-sync"  │               │
│             └───────────────────┘  └───────────────────┘               │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   Notification System                             │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │  │
│  │  │ Web Audio   │  │ Browser      │  │ Toast Notifications     │ │  │
│  │  │ 800Hz→1000Hz│  │ Notifications│  │ (In-App)                │ │  │
│  │  │ 2-tone chime│  │ (Permission) │  │ (5s auto-dismiss)       │ │  │
│  │  └─────────────┘  └──────────────┘  └─────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Service Counters: G (5min) | E (3min) | P (8min)                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend Framework:** React 18 with TypeScript
- **State Management:** React Context API
- **Styling:** Tailwind CSS v4
- **Icons:** lucide-react
- **Build Tool:** Vite
- **Persistence:** Browser localStorage API
- **Cross-Tab Sync:** Browser BroadcastChannel API

## Components and Interfaces

### 1. QueueContext (State Management)

**Responsibility:** Central state management for all queue operations, persistence, and cross-tab synchronization.

**State Structure:**

```typescript
interface Visitor {
  id: string;                           // UUID
  token: string;                        // Format: "{Counter}-{Number}" e.g., "G-00012"
  serviceCounter: ServiceCounter;       // "General Service Desk" | "Express Counter" | "Priority & Support Desk"
  counterCode: CounterCode;             // "G" | "E" | "P"
  priority: Priority;                   // "Normal" | "Urgent"
  registeredAt: number;                 // Unix timestamp in milliseconds
  status: VisitorStatus;                // "waiting" | "approaching" | "called" | "completed" | "no-show"
  position: number;                     // Current queue position (1-indexed)
}

interface ServiceCounterQueue {
  serviceCounter: ServiceCounter;
  code: CounterCode;
  avgServiceTime: number;               // Average service time in minutes
  status: CounterStatus;                // "open" | "paused"
  visitors: Visitor[];
  nextTokenNumber: number;              // Sequential counter per service counter
}

interface QueueState {
  queues: {
    "General Service Desk": ServiceCounterQueue;
    "Express Counter": ServiceCounterQueue;
    "Priority & Support Desk": ServiceCounterQueue;
  };
  splitDemoMode: boolean;               // Split screen demo mode enabled
}
```

**Core Operations:**

```typescript
interface QueueContextType {
  state: QueueState;
  
  // Visitor operations
  registerVisitor(serviceCounter: ServiceCounter, priority: Priority): Visitor;
  
  // Service provider operations
  callNextVisitor(serviceCounter: ServiceCounter): Visitor | null;
  completeVisitor(visitorId: string): void;
  markNoShow(visitorId: string): void;
  toggleCounterStatus(serviceCounter: ServiceCounter): void;
  
  // Query operations
  getVisitorByToken(token: string): Visitor | null;
  getServiceCounterQueue(serviceCounter: ServiceCounter): ServiceCounterQueue;
  getQueuePosition(visitorId: string): number;
  calculateETA(visitorId: string): number;
  
  // UI operations
  toggleSplitDemoMode(): void;
}
```

**Priority-Aware FIFO Algorithm:**

```typescript
function sortQueue(visitors: Visitor[]): Visitor[] {
  return visitors.sort((a, b) => {
    // Priority: Urgent (0) before Normal (1)
    const priorityOrder = { Urgent: 0, Normal: 1 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    
    if (priorityDiff !== 0) {
      return priorityDiff; // Different priorities: urgent first
    }
    
    // Same priority: FIFO by registration timestamp
    return a.registeredAt - b.registeredAt;
  });
}

function recalculatePositions(queue: ServiceCounterQueue): void {
  const sortedVisitors = sortQueue(queue.visitors);
  sortedVisitors.forEach((visitor, index) => {
    visitor.position = index + 1; // 1-indexed positions
  });
}
```

**Token Generation:**

```typescript
function generateToken(
  serviceCounter: ServiceCounter, 
  counter: number
): string {
  const codes: Record<ServiceCounter, CounterCode> = {
    "General Service Desk": "G",
    "Express Counter": "E",
    "Priority & Support Desk": "P"
  };
  
  const code = codes[serviceCounter];
  const number = counter.toString().padStart(5, "0");
  
  return `${code}-${number}`;
}
```

**ETA Calculation:**

```typescript
function calculateETA(visitor: Visitor, queue: ServiceCounterQueue): number {
  // ETA = number of people ahead × average service time
  const peopleAhead = visitor.position - 1;
  
  if (peopleAhead < 0) {
    return 0; // Visitor not in queue or already called
  }
  
  if (visitor.status === "called") {
    return 0; // Already being served
  }
  
  const eta = peopleAhead * queue.avgServiceTime;
  return Math.max(0, eta);
}

function formatETA(minutes: number): string {
  if (minutes === 0) {
    return "Your turn!";
  }
  
  const mins = Math.round(minutes);
  return mins === 1 ? `${mins} min` : `${mins} mins`;
}
```

**LocalStorage Persistence:**

```typescript
const STORAGE_KEY = "queueflow-data";
const SPLIT_MODE_KEY = "queueflow-split-mode";

function saveToStorage(state: QueueState): void {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(SPLIT_MODE_KEY, String(state.splitDemoMode));
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      // Handle storage quota exceeded
      displayError("Storage full: Unable to save queue data");
    }
    throw error;
  }
}

function loadFromStorage(): QueueState | null {
  const json = localStorage.getItem(STORAGE_KEY);
  if (!json) return null;
  
  try {
    const state = JSON.parse(json) as QueueState;
    
    // Restore split demo mode
    const splitMode = localStorage.getItem(SPLIT_MODE_KEY);
    if (splitMode !== null) {
      state.splitDemoMode = splitMode === "true";
    }
    
    return state;
  } catch {
    return null; // Corrupted data: return null to initialize fresh
  }
}
```

**Cross-Tab Synchronization:**

```typescript
const BROADCAST_CHANNEL_NAME = "queueflow-sync";

class QueueSync {
  private channel: BroadcastChannel | null;
  
  constructor() {
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this.channel.onmessage = this.handleMessage.bind(this);
    } else {
      displayError("Real-time sync unavailable: BroadcastChannel not supported");
      this.channel = null;
    }
  }
  
  broadcast(state: QueueState): void {
    if (this.channel) {
      this.channel.postMessage(state);
    }
  }
  
  private handleMessage(event: MessageEvent<QueueState>): void {
    const newState = event.data;
    // Update React state
    updateState(newState);
    // Sync to localStorage
    saveToStorage(newState);
  }
  
  close(): void {
    this.channel?.close();
  }
}
```

### 2. UserView Component

**Responsibility:** Visitor-facing interface (User_View) displaying queue status, ETA, and visual alerts.

**Visual State Logic:**

```typescript
function getVisualState(visitor: Visitor): VisualState {
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
}
```

**Component Structure:**

```tsx
function UserView({ token }: { token: string }) {
  const { state, getVisitorByToken, calculateETA } = useQueueContext();
  const visitor = getVisitorByToken(token);
  
  if (!visitor) {
    return <ErrorState message="Token not found" />;
  }
  
  const queue = state.queues[visitor.serviceCounter];
  const eta = calculateETA(visitor.id);
  const visualState = getVisualState(visitor);
  
  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <Card className="max-w-2xl mx-auto">
        <TokenDisplay token={visitor.token} size="large" />
        <StatusBadge 
          state={visualState.state}
          color={visualState.color}
          message={visualState.message}
        />
        <VisitorInfo
          serviceCounter={visitor.serviceCounter}
          priority={visitor.priority}
          position={visitor.position}
          eta={formatETA(eta)}
        />
      </Card>
    </div>
  );
}
```

### 3. ProviderConsole Component

**Responsibility:** Service provider-facing interface for managing all service counter queues.

**Component Structure:**

```tsx
function ProviderConsole() {
  const { 
    state, 
    callNextVisitor, 
    completeVisitor, 
    markNoShow,
    toggleCounterStatus,
    calculateETA 
  } = useQueueContext();
  
  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <Header title="Provider Console - QueueFlow" />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {["General Service Desk", "Express Counter", "Priority & Support Desk"].map(counter => (
          <ServiceCounterPanel
            key={counter}
            serviceCounter={counter}
            queue={state.queues[counter]}
            onCallNext={() => callNextVisitor(counter)}
            onComplete={completeVisitor}
            onNoShow={markNoShow}
            onToggleStatus={() => toggleCounterStatus(counter)}
            calculateETA={calculateETA}
          />
        ))}
      </div>
    </div>
  );
}

function ServiceCounterPanel({
  serviceCounter,
  queue,
  onCallNext,
  onComplete,
  onNoShow,
  onToggleStatus,
  calculateETA
}: ServiceCounterPanelProps) {
  const isOpen = queue.status === "open";
  
  return (
    <Card>
      <ServiceCounterHeader 
        name={serviceCounter}
        count={queue.visitors.length}
        status={queue.status}
        onToggleStatus={onToggleStatus}
      />
      
      <VisitorList>
        {queue.visitors.map(visitor => (
          <VisitorRow
            key={visitor.id}
            visitor={visitor}
            eta={formatETA(calculateETA(visitor.id))}
            onComplete={() => onComplete(visitor.id)}
            onNoShow={() => onNoShow(visitor.id)}
            isUrgent={visitor.priority === "Urgent"}
            isCalled={visitor.status === "called"}
          />
        ))}
      </VisitorList>
      
      <Button
        onClick={onCallNext}
        disabled={queue.visitors.length === 0 || !isOpen}
        variant="primary"
      >
        Call Next Visitor
      </Button>
    </Card>
  );
}
```

### 4. RegistrationForm Component

**Responsibility:** Visitor registration interface for queue entry.

**Component Structure:**

```tsx
function RegistrationForm() {
  const { registerVisitor } = useQueueContext();
  const [serviceCounter, setServiceCounter] = useState<ServiceCounter | null>(null);
  const [priority, setPriority] = useState<Priority>("Normal");
  const [registeredToken, setRegisteredToken] = useState<string | null>(null);
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!serviceCounter) return;
    
    const visitor = registerVisitor(serviceCounter, priority);
    setRegisteredToken(visitor.token);
    
    // Request notification permission after registration
    requestNotificationPermission();
  };
  
  if (registeredToken) {
    return <TokenConfirmation token={registeredToken} />;
  }
  
  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6">
      <ServiceCounterSelector
        value={serviceCounter}
        onChange={setServiceCounter}
        options={[
          { name: "General Service Desk", code: "G", avgTime: 5 },
          { name: "Express Counter", code: "E", avgTime: 3 },
          { name: "Priority & Support Desk", code: "P", avgTime: 8 }
        ]}
      />
      
      <PrioritySelector
        value={priority}
        onChange={setPriority}
        options={["Normal", "Urgent"]}
      />
      
      <Button type="submit" disabled={!serviceCounter}>
        Register
      </Button>
    </form>
  );
}
```

### 5. SplitDemoMode Component

**Responsibility:** Side-by-side display of User_View and Provider_Console for demonstration purposes (Split_Demo_Mode).

**Component Structure:**

```tsx
function SplitDemoMode() {
  const { state, toggleSplitDemoMode } = useQueueContext();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  
  // Check viewport width
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  
  useEffect(() => {
    // Request notification permission when split mode is enabled
    if (state.splitDemoMode) {
      requestNotificationPermission();
    }
  }, [state.splitDemoMode]);
  
  if (!isDesktop && state.splitDemoMode) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <p className="text-center text-slate-600">
            Split Demo Mode requires desktop viewport (≥1024px width)
          </p>
          <Button onClick={toggleSplitDemoMode} className="mt-4">
            Exit Split Mode
          </Button>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex">
      {/* Left half: User_View */}
      <div className="w-1/2 border-r border-slate-200 overflow-y-auto">
        {selectedToken ? (
          <UserView token={selectedToken} />
        ) : (
          <TokenSelector onSelect={setSelectedToken} />
        )}
      </div>
      
      {/* Right half: Provider_Console */}
      <div className="w-1/2 overflow-y-auto">
        <ProviderConsole />
      </div>
    </div>
  );
}
```

### 6. NotificationSystem Component

**Responsibility:** Multi-modal notifications for approaching and called states.

**Web Audio Synthesizer:**

```typescript
class AudioNotifier {
  private audioContext: AudioContext | null = null;
  
  constructor() {
    if (typeof AudioContext !== "undefined" || typeof (window as any).webkitAudioContext !== "undefined") {
      this.audioContext = new (AudioContext || (window as any).webkitAudioContext)();
    }
  }
  
  play2ToneChime(): void {
    if (!this.audioContext) {
      console.warn("Web Audio API not supported");
      return;
    }
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // First tone: 800 Hz for 200ms
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    
    osc1.type = "sine";
    osc1.frequency.value = 800;
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc1.start(now);
    osc1.stop(now + 0.2);
    
    // Second tone: 1000 Hz for 200ms, starting 300ms after first tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    
    osc2.type = "sine";
    osc2.frequency.value = 1000;
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    const startTime = now + 0.3; // 200ms + 100ms gap
    gain2.gain.setValueAtTime(0.3, startTime);
    gain2.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
    
    osc2.start(startTime);
    osc2.stop(startTime + 0.2);
  }
}
```

**Browser Notifications:**

```typescript
class BrowserNotifier {
  private hasPermission: boolean = false;
  
  async requestPermission(): Promise<void> {
    if (!("Notification" in window)) {
      console.warn("Browser notifications not supported");
      return;
    }
    
    if (Notification.permission === "granted") {
      this.hasPermission = true;
      return;
    }
    
    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === "granted";
    }
  }
  
  show(title: string, body: string): void {
    if (!this.hasPermission) return;
    
    const notification = new Notification(title, {
      body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: "queueflow-notification",
      renotify: true
    });
    
    // Auto-close after 10 seconds
    setTimeout(() => notification.close(), 10000);
  }
}
```

**Toast Notifications:**

```tsx
function ToastNotification({ 
  message, 
  onDismiss 
}: ToastNotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  
  return (
    <div 
      className="fixed top-4 right-4 max-w-md bg-white shadow-lg rounded-lg p-4 
                 border-l-4 border-indigo-600 animate-slide-in"
      role="alert"
    >
      <div className="flex items-start">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-900">{message}</p>
        </div>
        <button
          onClick={onDismiss}
          className="ml-4 text-slate-400 hover:text-slate-600"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
```

**Notification Manager:**

```typescript
class NotificationManager {
  private audio = new AudioNotifier();
  private browser = new BrowserNotifier();
  private toastCallback: ((message: string) => void) | null = null;
  
  setToastCallback(callback: (message: string) => void): void {
    this.toastCallback = callback;
  }
  
  async requestPermission(): Promise<void> {
    await this.browser.requestPermission();
  }
  
  notifyApproaching(token: string, position: number): void {
    const message = `Token ${token}: You're approaching! Position ${position}`;
    
    // Audio chime
    this.audio.play2ToneChime();
    
    // Browser notification
    this.browser.show("Your Turn is Approaching", message);
    
    // Toast notification
    this.toastCallback?.(message);
  }
  
  notifyCalled(token: string): void {
    const message = `Token ${token}: Please proceed to service counter`;
    
    // Audio chime
    this.audio.play2ToneChime();
    
    // Browser notification
    this.browser.show("You're Being Called!", message);
    
    // Toast notification
    this.toastCallback?.(message);
  }
}
```

## Data Models

### Core Types

```typescript
// Visitor entity
interface Visitor {
  id: string;                           // UUID
  token: string;                        // Format: "{Counter}-{Number}" e.g., "G-00012"
  serviceCounter: ServiceCounter;       // "General Service Desk" | "Express Counter" | "Priority & Support Desk"
  counterCode: CounterCode;             // "G" | "E" | "P"
  priority: Priority;                   // "Normal" | "Urgent"
  registeredAt: number;                 // Unix timestamp in milliseconds
  status: VisitorStatus;                // "waiting" | "approaching" | "called" | "completed" | "no-show"
  position: number;                     // Current queue position (1-indexed)
}

// Type aliases
type ServiceCounter = "General Service Desk" | "Express Counter" | "Priority & Support Desk";
type CounterCode = "G" | "E" | "P";
type Priority = "Normal" | "Urgent";
type VisitorStatus = "waiting" | "approaching" | "called" | "completed" | "no-show";
type CounterStatus = "open" | "paused";

// Service counter queue entity
interface ServiceCounterQueue {
  serviceCounter: ServiceCounter;
  code: CounterCode;
  avgServiceTime: number;               // Average service time in minutes
  status: CounterStatus;                // "open" | "paused"
  visitors: Visitor[];
  nextTokenNumber: number;              // Sequential counter per service counter
}

// Root state entity
interface QueueState {
  queues: {
    "General Service Desk": ServiceCounterQueue;
    "Express Counter": ServiceCounterQueue;
    "Priority & Support Desk": ServiceCounterQueue;
  };
  splitDemoMode: boolean;               // Split screen demo mode enabled
}

// Visual state for UI
interface VisualState {
  state: "waiting" | "approaching" | "called";
  color: string;  // Tailwind color class
  message: string; // User-facing message
}
```

### Data Validation Rules

1. **Token Format:** Must match regex `^[GEP]-\d{5}$`
2. **Position Range:** Must be positive integer ≥ 1
3. **Timestamp:** Must be Unix timestamp in milliseconds
4. **Counter Codes:** Must be exactly one of: G, E, P
5. **Priority:** Must be exactly one of: Normal, Urgent
6. **Status:** Must be exactly one of: waiting, approaching, called, completed, no-show
7. **Counter Status:** Must be exactly one of: open, paused
8. **ETA:** Must be non-negative number (minutes)

### LocalStorage Schema

**Key:** `queueflow-data`

**Value Structure:**
```json
{
  "queues": {
    "General Service Desk": {
      "serviceCounter": "General Service Desk",
      "code": "G",
      "avgServiceTime": 5,
      "status": "open",
      "nextTokenNumber": 13,
      "visitors": [
        {
          "id": "uuid-v4-string",
          "token": "G-00012",
          "serviceCounter": "General Service Desk",
          "counterCode": "G",
          "priority": "Urgent",
          "registeredAt": 1704067200000,
          "status": "waiting",
          "position": 1
        }
      ]
    },
    "Express Counter": { /* ... */ },
    "Priority & Support Desk": { /* ... */ }
  },
  "splitDemoMode": false
}
```

**Additional Keys:**
- `queueflow-split-mode`: Boolean string ("true" or "false") for Split_Demo_Mode persistence

## Data Flow

### Registration Flow

```
1. User fills RegistrationForm
2. User submits → registerVisitor(serviceCounter, priority)
3. QueueContext generates token with service counter counter
4. QueueContext creates Visitor object with timestamp
5. QueueContext adds visitor to service counter queue
6. QueueContext runs priority-FIFO sort
7. QueueContext recalculates all positions in queue
8. QueueContext calculates ETA for all visitors
9. QueueContext saves state to localStorage
10. QueueContext broadcasts state via BroadcastChannel
11. All tabs receive broadcast → update UI within 100ms
12. System requests notification permission
```

### Call Visitor Flow

```
1. Service provider clicks "Call Next Visitor" in Provider_Console
2. System checks if counter status is "open"
3. callNextVisitor(serviceCounter) → finds first visitor in sorted queue
4. Visitor status changed to "called"
5. NotificationManager triggers multi-modal notification:
   a. Web Audio plays 2-tone chime (800Hz 200ms, 100ms gap, 1000Hz 200ms)
   b. Browser notification displays (if permission granted)
   c. Toast notification appears for 5 seconds
6. QueueContext saves state to localStorage
7. QueueContext broadcasts state via BroadcastChannel
8. Visitor's User_View receives update → shows "called" state (emerald-500)
9. Provider_Console receives update → shows visitor as called
```

### Complete Visitor Flow

```
1. Service provider clicks "Complete" for called visitor
2. completeVisitor(visitorId) → removes visitor from queue
3. QueueContext recalculates positions for remaining visitors
4. QueueContext recalculates ETA for all affected visitors
5. QueueContext saves state to localStorage
6. QueueContext broadcasts state via BroadcastChannel
7. All tabs receive update → positions and ETAs updated
8. Visitors at position 3 may transition to "approaching" state (amber-500)
9. Approaching notification triggers for affected visitors
```

### No-Show Flow

```
1. Service provider clicks "No-Show / Skip" for called visitor
2. markNoShow(visitorId) → changes visitor status to "no-show"
3. QueueContext removes visitor from active queue
4. QueueContext recalculates positions for remaining visitors
5. QueueContext recalculates ETA for all affected visitors
6. QueueContext saves state to localStorage
7. QueueContext broadcasts state via BroadcastChannel
8. All tabs receive update → queue updated without marking visitor as completed
```

### Counter Status Toggle Flow

```
1. Service provider toggles "Open / Pause Counter" in Provider_Console
2. toggleCounterStatus(serviceCounter) → switches status between "open" and "paused"
3. If paused: "Call Next" button becomes disabled
4. If open: "Call Next" button becomes enabled
5. QueueContext saves state to localStorage (including counter status)
6. QueueContext broadcasts state via BroadcastChannel
7. All tabs receive update → counter status indicator updated
8. Note: Completing or marking no-show for already-called visitor is still allowed when paused
```

### Split Demo Mode Flow

```
1. User toggles "Split Demo Mode" control in application header
2. toggleSplitDemoMode() → flips splitDemoMode boolean
3. If viewport width < 1024px: Display warning message, stay in single view
4. If viewport width ≥ 1024px: Render side-by-side layout (Split_Demo_Mode)
5. Left half: User_View with token selector
6. Right half: Provider_Console
7. QueueContext saves splitDemoMode to localStorage
8. System requests notification permission
9. Both views maintain cross-tab sync
```

### ETA Calculation Flow

```
1. Visitor position changes (registration, call, complete, no-show)
2. QueueContext triggers recalculatePositions()
3. For each visitor in queue:
   a. Get position (1-indexed)
   b. Calculate peopleAhead = position - 1
   c. Get avgServiceTime from service counter config
   d. ETA = peopleAhead × avgServiceTime
   e. If position = 1 and not called: ETA = avgServiceTime
   f. If status = "called": ETA = 0
4. UI displays formatted ETA: "X min" / "X mins" / "Your turn!"
5. ETA updates propagate via BroadcastChannel
```

## Error Handling

### BroadcastChannel Not Supported

```typescript
if (typeof BroadcastChannel === "undefined") {
  // Display warning banner
  displayError({
    type: "warning",
    message: "Real-time sync unavailable. Queue updates require page refresh.",
    persistent: true
  });
  
  // Fallback: localStorage polling (optional)
  // Not implemented in hackathon MVP
}
```

### LocalStorage Quota Exceeded

```typescript
try {
  localStorage.setItem(STORAGE_KEY, json);
} catch (error) {
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    displayError({
      type: "error",
      message: "Storage full. Please clear browser data or contact support.",
      persistent: true
    });
    
    // Optional: Remove oldest completed/no-show visitors to free space
    // Not implemented in hackathon MVP
  }
}
```

### Corrupted LocalStorage Data

```typescript
function loadFromStorage(): QueueState | null {
  const json = localStorage.getItem(STORAGE_KEY);
  if (!json) return null;
  
  try {
    const parsed = JSON.parse(json);
    // Validate structure
    if (!isValidQueueState(parsed)) {
      console.error("Invalid queue state structure");
      return null; // Initialize fresh state
    }
    return parsed;
  } catch {
    console.error("Failed to parse queue state");
    return null; // Initialize fresh state
  }
}
```

### Web Audio API Not Supported

```typescript
if (!audioContext) {
  console.warn("Web Audio API not supported - audio notifications disabled");
  // Fall back to browser and toast notifications only
}
```

### Notification API Permission Denied

```typescript
if (Notification.permission === "denied") {
  console.warn("Notification permission denied - using audio and toast only");
  // Continue with audio chime and toast notifications
}
```

### Split Demo Mode on Small Viewport

```typescript
if (!isDesktop && state.splitDemoMode) {
  return (
    <div className="flex items-center justify-center p-4">
      <p>Split_Demo_Mode requires desktop viewport (≥1024px width)</p>
      <Button onClick={toggleSplitDemoMode}>Exit Split Mode</Button>
    </div>
  );
}
```

## Styling System

### Design Tokens

```typescript
const colors = {
  // Application background
  background: "slate-50",
  
  // Cards and elevated surfaces
  surface: "white",
  
  // Primary actions and branding
  primary: "indigo-600",
  primaryHover: "indigo-700",
  
  // Status colors
  called: "emerald-500",
  approaching: "amber-500",
  urgent: "rose-500",
  waiting: "slate-600",
  
  // Text colors
  textPrimary: "slate-900",
  textSecondary: "slate-600",
  textMuted: "slate-400"
};

const transitions = {
  fast: "150ms",
  normal: "200ms",
  slow: "300ms"
};
```

### Responsive Breakpoints

```typescript
const breakpoints = {
  sm: "640px",   // Mobile landscape
  md: "768px",   // Tablet portrait
  lg: "1024px",  // Tablet landscape / Small desktop
  xl: "1280px",  // Desktop
  "2xl": "1536px" // Large desktop
};
```

### Component Variants

```tsx
// Button variants
<Button variant="primary">Call Next Patient</Button>
<Button variant="secondary">Refresh</Button>
<Button variant="danger">Remove Patient</Button>

// Badge variants for priority
<Badge variant="urgent">Urgent</Badge>
<Badge variant="normal">Normal</Badge>

// Card for queue panels
<Card className="transition-all duration-200 hover:shadow-lg">
  {children}
</Card>
```

## Performance Considerations

### Optimization Strategies

1. **Queue Sorting:** Memoize sorted queues to avoid re-sorting on every render
   ```typescript
   const sortedQueue = useMemo(
     () => sortQueue(queue.visitors),
     [queue.visitors]
   );
   ```

2. **Position Recalculation:** Only recalculate positions when queue changes
   ```typescript
   useEffect(() => {
     recalculatePositions(serviceCounterQueue);
   }, [serviceCounterQueue.visitors.length]);
   ```

3. **ETA Calculation:** Memoize ETA calculations per visitor
   ```typescript
   const eta = useMemo(
     () => calculateETA(visitor, queue),
     [visitor.position, queue.avgServiceTime]
   );
   ```

4. **BroadcastChannel Throttling:** Debounce rapid state changes
   ```typescript
   const debouncedBroadcast = debounce(broadcast, 50);
   ```

5. **LocalStorage Writes:** Batch writes to reduce I/O
   ```typescript
   const debouncedSave = debounce(saveToStorage, 50);
   ```

6. **Audio Context Reuse:** Create single AudioContext instance
   ```typescript
   const audioContext = useMemo(() => new AudioContext(), []);
   ```

7. **Notification Throttling:** Prevent duplicate notifications within 1 second
   ```typescript
   const lastNotification = useRef<number>(0);
   if (Date.now() - lastNotification.current > 1000) {
     triggerNotification();
     lastNotification.current = Date.now();
   }
   ```

### Scalability Limits

- **Max visitors per queue:** ~1000 (localStorage limit ~5-10MB)
- **Max concurrent tabs:** Unlimited (BroadcastChannel supports any number)
- **Update latency:** <100ms cross-tab (target per requirements)
- **Audio synthesis:** Negligible CPU impact (Web Audio API is optimized)
- **Toast notifications:** Max 5 concurrent toasts recommended

## Security Considerations

### Frontend-Only Constraints

- No authentication or authorization (hackathon MVP)
- No visitor data validation beyond format
- No audit logging
- No data encryption

### Future Enhancements for Production

1. Add backend API with authentication
2. Implement role-based access control (service provider vs. visitor)
3. Encrypt sensitive visitor data
4. Add audit logging for compliance
5. Implement rate limiting for registrations
6. Add CAPTCHA to prevent automated registrations

## Testing Strategy

### Unit Tests

- Token generation format and uniqueness
- Priority-FIFO queue sorting algorithm
- Position recalculation after queue changes
- Visual state calculation based on position
- Department configuration validation
- Error handling for storage quota and API support

### Property-Based Tests

Property-based tests verify universal properties across many generated inputs (minimum 100 iterations per test due to randomization). Each property test references its design document property.

- Queue ordering properties (priority and FIFO)
- Token format compliance across all departments and counters
- LocalStorage round-trip preservation
- Position calculation consistency
- State transitions (waiting → approaching → called)

### Integration Tests

- BroadcastChannel cross-tab synchronization timing (<100ms)
- LocalStorage persistence across page reloads
- Complete user flows (registration → waiting → approaching → called → completed)
- Edge cases (empty queues, BroadcastChannel unavailable, storage quota)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Token Format Compliance

**For any** service counter and token number, the generated token SHALL match the format "{CounterCode}-{FiveDigitNumber}" where CounterCode is exactly one character (G, E, or P) and FiveDigitNumber is exactly 5 digits with leading zeros, and the complete token value SHALL be displayed without masking or truncation in all views.

**Validates: Requirements 1.3, 1.5, 3.1, 7.1, 7.2, 8.4**

### Property 2: Token Uniqueness

**For any** sequence of visitor registrations, each generated token SHALL be unique across all service counters and all time within the system's operational lifetime.

**Validates: Requirements 1.3**

### Property 3: Priority-Aware FIFO Ordering

**For any** service counter queue containing mixed priority visitors, all Urgent priority visitors SHALL appear before all Normal priority visitors, and within each priority level, visitors SHALL be ordered by registration timestamp in ascending order (earliest first).

**Validates: Requirements 2.2, 2.3, 2.4, 4.4**

### Property 4: Queue Isolation

**For any** set of visitor registrations across multiple service counters, each service counter queue SHALL contain only visitors registered for that specific service counter, with no cross-counter contamination.

**Validates: Requirements 2.1**

### Property 5: Position Recalculation After Removal

**For any** service counter queue, when a visitor is removed, all remaining visitors SHALL have positions recalculated to be sequential starting from 1 with no gaps (1, 2, 3, ..., N where N is the remaining queue length).

**Validates: Requirements 2.5**

### Property 6: Queue Position Matches Ordering

**For any** visitor in a service counter queue, the visitor's assigned Queue_Position SHALL equal their index + 1 in the priority-aware FIFO ordered list of visitors for that service counter.

**Validates: Requirements 1.6, 2.4, 3.2**

### Property 7: Registration Adds to Correct Queue

**For any** visitor registration with specified service counter and priority, the system SHALL add the visitor to the selected service counter queue with the specified priority level, and the visitor SHALL appear in subsequent queries of that service counter queue.

**Validates: Requirements 1.4**

### Property 8: LocalStorage Persistence Format

**For any** queue state, when persisted to localStorage, the data SHALL be stored as valid JSON in the key "queueflow-data" and SHALL contain all required fields (queues, visitors, tokens, positions, priorities, states, counter statuses).

**Validates: Requirements 1.7, 2.6, 10.5, 15.8**

### Property 9: LocalStorage Round-Trip Preservation

**For any** complete queue state, saving to localStorage and then loading from localStorage SHALL produce a logically equivalent queue state with all visitors, tokens, positions, priorities, statuses, and counter statuses preserved.

**Validates: Requirements 6.4, 10.2, 10.3, 15.9**

### Property 10: BroadcastChannel Notification

**For any** queue state modification (registration, call, complete, no-show, counter status toggle), the system SHALL broadcast a message via BroadcastChannel with channel name "queueflow-sync" containing the updated queue state.

**Validates: Requirements 1.8, 4.6, 4.8, 6.1, 14.5, 15.6**

### Property 11: BroadcastChannel Message Synchronization

**For any** received BroadcastChannel message containing queue state, the receiving tab SHALL update localStorage with the received data, ensuring cross-tab data consistency.

**Validates: Requirements 6.3**

### Property 12: Visual State Calculation

**For any** visitor, the calculated visual state SHALL be "called" if status is "called", "approaching" if position is 2 or less and status is not "called", and "waiting" if position is greater than 2 and status is not "called".

**Validates: Requirements 3.5, 3.6, 3.7, 5.1**

### Property 13: Visitor Information Display in User_View

**For any** visitor in User_View, the displayed information SHALL include the complete token value, current position, service counter name, and priority level without omission.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 14: Provider_Console Visitor Display

**For any** visitor displayed in Provider_Console, the rendered output SHALL include the visitor's token, queue position, priority level, and calculated ETA.

**Validates: Requirements 4.2, 11.7**

### Property 15: Priority Visual Distinction

**For any** two visitors displayed in Provider_Console with different priorities, the visual styling applied SHALL differ such that Urgent priority visitors use rose-500 color styling and Normal priority visitors use default styling.

**Validates: Requirements 4.3**

### Property 16: Call Next Visitor State Transition

**For any** service counter queue with at least one visitor and counter status "open", calling the next visitor SHALL transition the first visitor (position 1) in the sorted queue to "called" status.

**Validates: Requirements 4.5**

### Property 17: Complete Visitor Removal

**For any** visitor in "called" status, completing that visitor SHALL remove them from the service counter queue entirely, resulting in a queue that does not contain the completed visitor.

**Validates: Requirements 4.7**

### Property 18: No-Show Visitor Removal

**For any** visitor in "called" status, marking them as no-show SHALL transition the visitor to "no-show" status and remove them from the active queue.

**Validates: Requirements 14.2, 14.3**

### Property 19: Service Counter Queue Count

**For any** service counter queue, the displayed visitor count SHALL equal the number of visitors in that service counter's queue who have not been completed or marked as no-show.

**Validates: Requirements 4.9**

### Property 20: Approaching Message Display

**For any** visitor with position 2 or less and status not "called", the User_View SHALL display text indicating the visitor is approaching their turn.

**Validates: Requirements 5.4**

### Property 21: Independent Service Counter Counters

**For any** sequence of registrations across multiple service counters, each service counter SHALL maintain an independent sequential token counter, such that registering visitors at service counter G does not affect the next token number for service counters E or P.

**Validates: Requirements 8.5**

### Property 22: Empty Queue Initialization

**For any** application initialization with empty localStorage, the system SHALL create empty queues for all three service counters (General Service Desk, Express Counter, Priority & Support Desk) with next token numbers initialized to 1 and counter statuses initialized to "open".

**Validates: Requirements 10.4, 15.10**

### Property 23: ETA Calculation Formula

**For any** visitor at position N in a service counter with average service time T minutes, the calculated ETA SHALL equal (N - 1) × T minutes.

**Validates: Requirements 11.1**

### Property 24: ETA Display for Called Visitors

**For any** visitor with status "called" or position 0, the User_View SHALL display "Your turn!" instead of a numerical ETA value.

**Validates: Requirements 11.5**

### Property 25: ETA Singular/Plural Grammar

**For any** visitor with ETA equal to 1 minute, the User_View SHALL display "1 min", and for any ETA not equal to 1, the User_View SHALL display "{number} mins" with plural form.

**Validates: Requirements 11.6**

### Property 26: Split_Demo_Mode Persistence

**For any** toggle of Split_Demo_Mode state, the system SHALL persist the new state to localStorage with key "queueflow-split-mode" and restore it on application initialization.

**Validates: Requirements 12.6, 12.7**

### Property 27: Split_Demo_Mode Layout on Desktop

**For any** desktop viewport with width ≥1024px and Split_Demo_Mode enabled, the system SHALL display User_View on the left half and Provider_Console on the right half with equal width allocation.

**Validates: Requirements 12.2, 12.3**

### Property 28: Split_Demo_Mode Warning on Mobile

**For any** viewport with width <1024px and Split_Demo_Mode enabled, the system SHALL display a message indicating Split_Demo_Mode requires desktop viewport.

**Validates: Requirements 12.5**

### Property 29: Multi-Modal Notification Trigger on Approaching

**For any** visitor whose Queue_Position changes to 2 or less, the system SHALL trigger a multi-modal notification including audio chime, browser notification (if permitted), and toast notification.

**Validates: Requirements 5.1, 13.1**

### Property 30: Multi-Modal Notification Trigger on Called

**For any** visitor whose status transitions to "called", the system SHALL trigger a multi-modal notification including audio chime, browser notification (if permitted), and toast notification.

**Validates: Requirements 13.2**

### Property 31: Web Audio Chime Frequency Sequence

**For any** multi-modal notification, the Web Audio synthesizer SHALL generate a first tone at 800 Hz for 200 milliseconds, followed by a 100 millisecond gap, followed by a second tone at 1000 Hz for 200 milliseconds.

**Validates: Requirements 13.4, 13.5**

### Property 32: Toast Auto-Dismiss Timing

**For any** toast notification displayed, the system SHALL automatically dismiss the toast after exactly 5 seconds unless manually dismissed earlier.

**Validates: Requirements 13.10**

### Property 33: Counter Status Disables Call Next

**For any** service counter with status "paused", the Provider_Console SHALL disable the "Call Next" action button for that service counter.

**Validates: Requirements 15.3**

### Property 34: Counter Status Enables Call Next

**For any** service counter with status "open", the Provider_Console SHALL enable the "Call Next" action button for that service counter.

**Validates: Requirements 15.5**

### Property 35: Counter Status Initialization

**For any** application initialization, each service counter SHALL be initialized with status "open" if no prior status data exists in localStorage.

**Validates: Requirements 15.2, 15.10**

### Property 36: No-Show Action Available When Called

**For any** visitor in "called" status, the Provider_Console SHALL display a "No-Show / Skip" action button for that visitor.

**Validates: Requirements 14.1**

### Property 37: Position Recalculation After No-Show

**For any** visitor marked as no-show, all remaining visitors in that service counter queue SHALL have their Queue_Position recalculated immediately.

**Validates: Requirements 14.4**

## Deployment

### Build Process

```bash
# Install dependencies
npm install

# Development server (manual - not automated)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Static Hosting

The application generates static files suitable for:
- GitHub Pages
- Netlify
- Vercel
- Any static file host

**Build output:** `dist/` directory contains all static assets.

### Browser Requirements

- Modern browsers supporting:
  - ES2020+ JavaScript
  - localStorage API
  - BroadcastChannel API (optional, degrades gracefully)
  - CSS Grid and Flexbox

**Minimum versions:**
- Chrome/Edge: 87+
- Firefox: 78+
- Safari: 14+

## Future Enhancements

### Phase 2 (Post-Hackathon)

1. **Backend Integration**
   - REST API for queue operations
   - WebSocket for real-time updates across devices
   - PostgreSQL database for persistence

2. **Authentication & Authorization**
   - Staff login with role-based access
   - Patient token authentication for privacy

3. **Enhanced Features**
   - SMS notifications for approaching turns
   - Average wait time estimation
   - Queue analytics dashboard
   - Multi-language support

4. **Mobile App**
   - React Native mobile app
   - Push notifications
   - QR code token scanning

### Phase 3 (Production-Ready)

1. **Compliance & Security**
   - HIPAA compliance measures
   - Data encryption at rest and in transit
   - Audit logging for all operations
   - Regular security audits

2. **Scalability**
   - Distributed queue management
   - Multi-location support
   - Load balancing for high traffic
   - Database sharding for large hospitals

3. **Advanced Features**
   - AI-powered wait time prediction
   - Automated queue optimization
   - Integration with hospital EHR systems
   - Telemedicine queue integration

## Conclusion

The QueueFlow system provides a complete frontend-only queue management solution suitable for rapid deployment in a hackathon environment. The architecture leverages React Context for state management, browser-native APIs (localStorage and BroadcastChannel) for persistence and cross-tab synchronization, and Tailwind CSS v4 for a modern interface. The design prioritizes simplicity, correctness through property-based testing, and real-time user experience with multi-modal notifications (Web Audio synthesized chime, browser notifications, and toast notifications), ETA calculations, Split_Demo_Mode for demonstrations, no-show management, and per-counter open/pause controls. The system supports three service counters (General Service Desk with code G and 5 min average service time, Express Counter with code E and 3 min average service time, Priority & Support Desk with code P and 8 min average service time) while acknowledging the limitations of a frontend-only approach for production service environments.
