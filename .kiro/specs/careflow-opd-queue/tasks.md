# Implementation Plan: QueueFlow Queue Management System

## Overview

This plan implements a frontend-only Smart Virtual Queue Management System for general-purpose service counters. The system uses React with TypeScript, browser localStorage for persistence, and BroadcastChannel API for real-time cross-tab synchronization. Implementation is optimized for a 2.5-hour hackathon timeframe, focusing on core functionality including real-time ETA calculation, split demo mode, multi-modal notifications, and service counter controls.

## Tasks

- [ ] 1. Set up core data models and queue context
  - Create TypeScript interfaces for Visitor, ServiceCounterQueue, and QueueState
  - Implement QueueContext with React Context API
  - Create priority-aware FIFO sorting function
  - Implement token generation with service counter codes (G, E, P) and 5-digit zero-padded numbers
  - Add ETA calculation function (peopleAhead × avgServiceTime)
  - Add counter status management (open/paused) with initial state
  - Add localStorage persistence functions (save/load with error handling, keys: "queueflow-data", "queueflow-split-mode")
  - Add BroadcastChannel setup for cross-tab synchronization (channel: "queueflow-sync")
  - Initialize empty queues for all three service counters: General Service Desk (G, 5min), Express Counter (E, 3min), Priority & Support Desk (P, 8min)
  - _Requirements: 1.3, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.1, 6.3, 6.4, 8.1, 8.2, 8.3, 8.4, 8.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.1, 11.3, 11.4, 11.5, 15.2, 15.8, 15.9, 15.10_

- [ ] 2. Implement queue operations and notifications
  - [ ] 2.1 Create registerVisitor function
    - Generate unique token with service counter code prefix
    - Add visitor to service counter queue with timestamp
    - Run priority-FIFO sort and recalculate positions
    - Calculate ETA for all visitors in queue
    - Request Notification API permission after registration
    - Save to localStorage and broadcast via BroadcastChannel
    - _Requirements: 1.3, 1.4, 1.6, 1.7, 1.8, 2.4, 11.3, 13.8_
  
  - [ ] 2.2 Create callNextVisitor function
    - Check if counter status is "open" (skip if paused)
    - Find first visitor in sorted queue
    - Change status to "called"
    - Trigger multi-modal notification (audio chime + browser notification + toast)
    - Save and broadcast state change
    - _Requirements: 4.5, 4.6, 13.2, 15.3, 15.5_
  
  - [ ] 2.3 Create completeVisitor function
    - Remove visitor from queue
    - Recalculate positions and ETAs for remaining visitors
    - Check if any visitors transition to "approaching" state (position ≤ 2)
    - Trigger approaching notifications for affected visitors
    - Save and broadcast state change
    - _Requirements: 2.5, 4.7, 4.8, 11.3, 13.1_
  
  - [ ] 2.4 Create markNoShow function
    - Change visitor status to "no-show"
    - Remove visitor from active queue
    - Recalculate positions and ETAs for remaining visitors
    - Save and broadcast state change
    - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.6_
  
  - [ ] 2.5 Create toggleCounterStatus function
    - Toggle counter status between "open" and "paused"
    - Disable/enable "Call Next" button based on status
    - Save counter status to localStorage
    - Broadcast status change via BroadcastChannel
    - _Requirements: 15.3, 15.5, 15.6, 15.7_

- [ ] 3. Build multi-modal notification system
  - [ ] 3.1 Implement Web Audio API chime synthesizer
    - Create AudioNotifier class with 2-tone chime method
    - First tone: 800 Hz sine wave for 200ms
    - 100ms gap
    - Second tone: 1000 Hz sine wave for 200ms
    - Handle AudioContext initialization and browser compatibility
    - _Requirements: 13.3, 13.4, 13.5_
  
  - [ ] 3.2 Implement Browser Notification API integration
    - Create BrowserNotifier class with permission request
    - Display browser notification with token and status message
    - Handle permission denied gracefully
    - Auto-close notifications after 10 seconds
    - _Requirements: 13.6, 13.8, 13.9_
  
  - [ ] 3.3 Build toast notification component
    - Create ToastNotification component with dismiss button
    - Auto-dismiss after 5 seconds
    - Support manual dismissal
    - Position fixed top-right with slide-in animation
    - _Requirements: 13.7, 13.10, 13.11_
  
  - [ ] 3.4 Create NotificationManager orchestrator
    - Coordinate all three notification types
    - Trigger notifications when position ≤ 2 (approaching)
    - Trigger notifications when status changes to "called"
    - Integrate with QueueContext for automatic triggers
    - _Requirements: 13.1, 13.2_

- [ ] 4. Build User View (visitor interface) with ETA display
  - [ ] 4.1 Create visual state calculator
    - Return "called" state with emerald-500 color when status is "called"
    - Return "approaching" state with amber-500 color when position ≤ 2
    - Return "waiting" state with slate-600 color when position > 2
    - _Requirements: 3.5, 3.6, 3.7, 5.1, 5.2, 5.3, 9.4, 9.5_
  
  - [ ] 4.2 Build visitor display interface
    - Display full token prominently
    - Show current queue position and service counter name
    - Display priority level
    - Show ETA in minutes with format "X min" / "X mins" / "Your turn!"
    - Display approaching message when position ≤ 2
    - Apply appropriate visual state styling with smooth transitions (150-300ms)
    - Listen to Cross_Tab_Sync and update within 100ms
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.8, 5.4, 7.4, 9.7, 11.2, 11.6_
  
  - [ ] 4.3 Build RegistrationForm component
    - Create form with service counter selector (General Service Desk, Express Counter, Priority & Support Desk)
    - Display avg wait time and current queue count per counter
    - Add priority selector (Normal, Urgent)
    - Display generated token after successful registration
    - Include complete token value without masking
    - Style with Tailwind CSS v4 (indigo-600 primary color, white cards on slate-50 background)
    - _Requirements: 1.1, 1.2, 1.5, 7.1, 7.2, 7.3, 9.1, 9.2, 9.3, 9.8, 9.9_

- [ ] 5. Build Provider Console with counter controls
  - [ ] 5.1 Create ServiceCounterPanel component
    - Display service counter name and visitor count
    - Add "Open / Pause Counter" toggle with visual indicator (green=open, amber=paused)
    - List all visitors with token, position, priority, and ETA
    - Visually distinguish Urgent (rose-500) from Normal priority visitors
    - Display queues ordered by priority-aware FIFO
    - Add "Call Next Visitor" button (disabled when queue empty or counter paused)
    - Add "Mark Completed" button for called visitors
    - Add "No-Show / Skip" button for called visitors (visually distinct from Complete)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 4.9, 9.6, 11.7, 14.1, 14.7, 15.1, 15.3, 15.4, 15.5, 15.11_
  
  - [ ] 5.2 Create main Provider Console layout
    - Display three service counter panels side-by-side (responsive grid)
    - Add KPI cards: Total Waiting, Avg Wait, Served Today (optional enhancement)
    - Listen to Cross_Tab_Sync and update within 100ms
    - Use Tailwind CSS v4 responsive breakpoints (sm, md, lg, xl)
    - Apply consistent styling (white cards, indigo primary actions)
    - _Requirements: 4.10, 9.8, 9.9_

- [ ] 6. Build Split Demo Mode and finalize integration
  - [ ] 6.1 Create Split Demo Mode component
    - Add "Split Demo Mode" toggle in application header
    - Display User_View (left) and Provider_Console (right) side-by-side when enabled on desktop (≥1024px)
    - Show warning message on mobile/tablet viewports (<1024px)
    - Add token selector for User_View in split mode
    - Persist split mode state to localStorage ("queueflow-split-mode")
    - Request notification permission when split mode is enabled
    - Maintain cross-tab sync between both views
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 13.8_
  
  - [ ] 6.2 Integrate routing and finalize application
    - Set up routing for RegistrationForm, User_View, Provider_Console, and Split Demo Mode
    - Add application header with "QueueFlow" branding and view toggle navigation
    - Add "Reset Demo" button to clear localStorage and reinitialize queues
    - Add error handling for BroadcastChannel unavailable (display warning banner)
    - Add error handling for localStorage quota exceeded
    - Wire all components to QueueContext
    - Add lucide-react icons for visual polish (Bell, Clock, Users, PlayCircle, PauseCircle, X, etc.)
    - Test complete user flows (registration → user view with ETA → provider console → call with notifications → complete/no-show)
    - Ensure responsive design works from 320px to 2560px viewports
    - Pre-seed queues with 5 realistic waiting visitors and 1 active called visitor for demo
    - _Requirements: 6.2, 6.5, 6.6, 9.10, 10.6_

## Notes

- All tasks focus on implementation only (no testing infrastructure)
- Designed for 2.5-hour hackathon timeframe
- Each task builds incrementally toward a working prototype
- TypeScript for type safety throughout
- BroadcastChannel provides real-time sync across tabs without backend
- localStorage provides persistence across page reloads
- Tailwind CSS v4 for rapid UI development
- Cross-tab updates target <100ms latency per requirements
- ETA calculation: peopleAhead × avgServiceMins (5, 3, or 8 minutes depending on counter)
- Multi-modal notifications: Web Audio chime (no external files) + Browser Notification + Toast
- Split Demo Mode showcases both interfaces side-by-side on desktop
- Counter status controls allow pausing/resuming service per counter
- No-Show management prevents queue blocking on unresponsive visitors

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "3.2", "3.3", "4.1", "4.3"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.4", "4.2", "5.1"] },
    { "id": 3, "tasks": ["5.2", "6.1"] },
    { "id": 4, "tasks": ["6.2"] }
  ]
}
```
