# Requirements Document

## Introduction

QueueFlow is a Smart Virtual Queue Management System designed for general-purpose service counter operations. The system manages visitor queues across multiple service counters with priority-aware FIFO processing, real-time synchronization across browser tabs, and provides separate interfaces for visitors and service providers. Built as a frontend-only solution for rapid deployment, it uses localStorage and BroadcastChannel for cross-tab synchronization on a single machine. The system includes estimated wait time calculations, multi-modal notifications, and split-screen demonstration capabilities.

## Glossary

- **System**: The QueueFlow Queue Management System
- **User_View**: The public-facing interface where visitors monitor their queue status
- **Provider_Console**: The service provider interface for managing queues and calling visitors
- **Queue**: An ordered list of visitors waiting for a specific service counter
- **Token**: A unique identifier assigned to a visitor in format "{Counter_Code}-{Number}" (e.g., "G-00012")
- **Service_Counter**: A service point where visitors are attended to (General Service Desk, Express Counter, Priority & Support Desk)
- **Priority**: A classification level (Normal, Urgent) that affects queue ordering
- **Queue_Position**: The numerical position of a visitor in their service counter queue
- **Called_State**: The state when a visitor token is actively being serviced
- **Approaching_State**: The state when a visitor is within 2 positions of being called
- **Waiting_State**: The state when a visitor is in queue but not approaching
- **Completed_State**: The state when a visitor has been serviced and removed from queue
- **No_Show_State**: The state when a called visitor is skipped without completing service
- **Cross_Tab_Sync**: Real-time data synchronization across multiple browser tabs using BroadcastChannel API
- **Local_Storage**: Browser-based persistent storage for queue data
- **ETA**: Estimated Time of Arrival, calculated as the number of people ahead multiplied by average service time in minutes
- **Average_Service_Time**: The typical duration in minutes to serve one visitor at a service counter
- **Split_Demo_Mode**: A display mode showing User_View and Provider_Console side-by-side on desktop viewports
- **Counter_Status**: The operational state of a service counter (Open or Paused)

## Requirements

### Requirement 1: Visitor Registration

**User Story:** As a visitor, I want to register for a queue by selecting my service counter and priority level, so that I receive a token and can monitor my queue position.

#### Acceptance Criteria

1.1 THE System SHALL provide a registration interface with service counter selection options for General Service Desk, Express Counter, and Priority & Support Desk

1.2 THE System SHALL provide priority level selection options for Normal and Urgent

1.3 WHEN a visitor submits registration, THE System SHALL generate a unique token in format "{Counter_Code}-{Number}" where Counter_Code is G for General Service Desk, E for Express Counter, P for Priority & Support Desk, and Number is a zero-padded 5-digit sequential number

1.4 WHEN a visitor submits registration, THE System SHALL add the visitor to the selected service counter queue with the specified priority

1.5 WHEN a visitor receives a token, THE System SHALL display the full token value without masking or truncation

1.6 WHEN a visitor receives a token, THE System SHALL display the initial queue position

1.7 WHEN registration is complete, THE System SHALL persist the queue data to Local_Storage

1.8 WHEN registration is complete, THE System SHALL broadcast the queue update to all open tabs via Cross_Tab_Sync

### Requirement 2: Queue Management

**User Story:** As the system, I want to maintain priority-aware FIFO queues for each service counter, so that urgent visitors are processed before normal visitors while maintaining fairness within priority levels.

#### Acceptance Criteria

2.1 THE System SHALL maintain separate queues for each Service_Counter

2.2 WHEN ordering visitors within a queue, THE System SHALL place Urgent priority visitors before Normal priority visitors

2.3 WHILE visitors share the same priority level, THE System SHALL order them by registration timestamp in ascending order

2.4 WHEN a visitor is added to a queue, THE System SHALL assign a Queue_Position based on priority-aware FIFO ordering

2.5 WHEN a visitor is removed from a queue, THE System SHALL recalculate Queue_Position for all remaining visitors in that service counter

2.6 THE System SHALL store queue data in Local_Storage for persistence across page reloads

### Requirement 3: User View Interface

**User Story:** As a visitor, I want to view my current queue status and position, so that I know when to expect my turn.

#### Acceptance Criteria

3.1 THE User_View SHALL display the visitor's full token value

3.2 THE User_View SHALL display the visitor's current Queue_Position

3.3 THE User_View SHALL display the visitor's Service_Counter name

3.4 THE User_View SHALL display the visitor's Priority level

3.5 WHEN the visitor's Queue_Position is greater than 2, THE User_View SHALL display Waiting_State visual styling

3.6 WHEN the visitor's Queue_Position is between 1 and 2 inclusive, THE User_View SHALL display Approaching_State visual styling

3.7 WHEN the visitor's token is called, THE User_View SHALL display Called_State visual styling

3.8 WHEN queue data changes in any tab, THE User_View SHALL update the displayed information within 100 milliseconds

### Requirement 4: Provider Console Interface

**User Story:** As a service provider, I want to view all service counter queues and call visitors in order, so that I can efficiently manage visitor flow.

#### Acceptance Criteria

4.1 THE Provider_Console SHALL display separate queue lists for each Service_Counter

4.2 THE Provider_Console SHALL display each visitor's token, Queue_Position, and Priority level

4.3 THE Provider_Console SHALL visually distinguish Urgent priority visitors from Normal priority visitors

4.4 THE Provider_Console SHALL display queues ordered by priority-aware FIFO rules

4.5 WHEN a service provider calls the next visitor, THE Provider_Console SHALL transition the first visitor in the selected service counter queue to Called_State

4.6 WHEN a service provider calls a visitor, THE Provider_Console SHALL broadcast the state change to all open tabs via Cross_Tab_Sync

4.7 THE Provider_Console SHALL provide an action to mark a called visitor as Completed_State and remove them from the queue

4.8 WHEN a visitor is marked as completed, THE Provider_Console SHALL broadcast the queue update to all open tabs via Cross_Tab_Sync

4.9 THE Provider_Console SHALL display a count of total visitors waiting in each Service_Counter

4.10 WHEN queue data changes in any tab, THE Provider_Console SHALL update the displayed queues within 100 milliseconds

### Requirement 5: Turn-Approaching Alerts

**User Story:** As a visitor, I want to receive visual alerts when my turn is approaching, so that I can prepare to be called.

#### Acceptance Criteria

5.1 WHEN a visitor's Queue_Position changes to 2 or less, THE User_View SHALL display an approaching notification

5.2 THE User_View SHALL use amber color styling (amber-500) to indicate Approaching_State

5.3 WHEN a visitor's Queue_Position changes from greater than 2 to 2 or less, THE User_View SHALL provide a visual transition to Approaching_State styling

5.4 THE User_View SHALL display text indicating the visitor is approaching their turn when Queue_Position is 2 or less

### Requirement 6: Real-Time Cross-Tab Synchronization

**User Story:** As a user, I want all open browser tabs to reflect the same queue state in real-time, so that I can monitor the system from multiple windows simultaneously.

#### Acceptance Criteria

6.1 WHEN queue data is modified in any tab, THE System SHALL broadcast the change using BroadcastChannel API with channel name "queueflow-sync"

6.2 WHEN a tab receives a broadcast message, THE System SHALL update the displayed queue data within 100 milliseconds

6.3 WHEN a tab receives a broadcast message, THE System SHALL synchronize Local_Storage with the received data

6.4 WHEN a new tab is opened, THE System SHALL load initial queue data from Local_Storage

6.5 THE System SHALL synchronize data only across tabs within the same browser on the same machine

6.6 IF BroadcastChannel API is not supported by the browser, THEN THE System SHALL display an error message indicating real-time sync is unavailable

### Requirement 7: Token Display Format

**User Story:** As a visitor, I want to see my complete token identifier clearly displayed, so that I can easily identify when I am called.

#### Acceptance Criteria

7.1 THE System SHALL display tokens in format "{Counter_Code}-{Number}" where Number is exactly 5 digits with leading zeros

7.2 THE System SHALL display the complete token value without masking, truncation, or abbreviation

7.3 THE System SHALL display tokens with sufficient font size and contrast for readability on both desktop and mobile devices

7.4 THE User_View SHALL display the token value prominently in the primary viewing area

### Requirement 8: Service Counter Configuration

**User Story:** As the system, I want to support exactly three service counters with predefined codes and average service times, so that token generation and queue management are consistent.

#### Acceptance Criteria

8.1 THE System SHALL support General Service Desk with code "G" and Average_Service_Time of 5 minutes

8.2 THE System SHALL support Express Counter with code "E" and Average_Service_Time of 3 minutes

8.3 THE System SHALL support Priority & Support Desk with code "P" and Average_Service_Time of 8 minutes

8.4 THE System SHALL use these service counter codes as prefixes for token generation

8.5 THE System SHALL maintain separate sequential number counters for each Service_Counter

### Requirement 9: User Interface Design

**User Story:** As a user, I want a modern, polished healthcare interface that works on both desktop and mobile devices, so that the system is professional and accessible.

#### Acceptance Criteria

9.1 THE System SHALL use a slate-50 background color for the main application

9.2 THE System SHALL use white elevated card components for queue displays

9.3 THE System SHALL use indigo-600 as the primary color for actions and branding

9.4 THE System SHALL use emerald-500 for Called_State visual styling

9.5 THE System SHALL use amber-500 for Approaching_State visual styling

9.6 THE System SHALL use rose-500 for Urgent priority visual styling

9.7 THE System SHALL provide smooth CSS transitions for state changes with duration between 150ms and 300ms

9.8 THE System SHALL render responsive layouts that adapt to viewport widths from 320px to 2560px

9.9 THE System SHALL use Tailwind CSS v4 for styling implementation

9.10 THE System SHALL use lucide-react icon library for interface icons

### Requirement 10: Data Persistence

**User Story:** As a user, I want queue data to persist across page reloads, so that the system maintains state during browser navigation.

#### Acceptance Criteria

10.1 WHEN queue data changes, THE System SHALL write the complete queue state to Local_Storage within 50 milliseconds

10.2 WHEN the application initializes, THE System SHALL load queue data from Local_Storage

10.3 IF Local_Storage contains queue data, THEN THE System SHALL restore all queues with their complete state including tokens, positions, priorities, and visitor states

10.4 IF Local_Storage is empty, THEN THE System SHALL initialize empty queues for all Service_Counters

10.5 THE System SHALL store queue data in JSON format in Local_Storage key "queueflow-data"

10.6 IF Local_Storage write fails due to quota exceeded, THEN THE System SHALL display an error message indicating storage is full

### Requirement 11: Estimated Wait Time Calculation

**User Story:** As a visitor, I want to see an estimated wait time for my turn, so that I can plan my time effectively.

#### Acceptance Criteria

11.1 THE System SHALL calculate ETA for each visitor as the number of people ahead in queue multiplied by the Average_Service_Time for their Service_Counter

11.2 THE User_View SHALL display the calculated ETA in minutes next to the Queue_Position

11.3 WHEN a visitor's Queue_Position changes, THE System SHALL recalculate and update the displayed ETA within 100 milliseconds

11.4 WHEN a visitor is at Queue_Position 1 and not yet called, THE System SHALL display ETA as the Average_Service_Time for their Service_Counter

11.5 WHEN a visitor is at Queue_Position 0 or in Called_State, THE System SHALL display "Your turn!" instead of an ETA value

11.6 THE User_View SHALL display ETA with the format "{number} min" or "{number} mins" with appropriate singular/plural grammar

11.7 THE Provider_Console SHALL display ETA for each visitor in the queue lists

### Requirement 12: Split Demo Mode

**User Story:** As a demonstrator, I want to view the User View and Provider Console side-by-side on a single screen, so that I can showcase both interfaces simultaneously during presentations.

#### Acceptance Criteria

12.1 THE System SHALL provide a Split_Demo_Mode toggle control in the application header

12.2 WHEN Split_Demo_Mode is enabled on a desktop viewport with width 1024px or greater, THE System SHALL display User_View on the left half and Provider_Console on the right half of the screen

12.3 WHEN Split_Demo_Mode is enabled, THE System SHALL divide the viewport vertically with equal width allocation to each interface

12.4 WHEN Split_Demo_Mode is disabled, THE System SHALL display only one interface at a time based on the current route

12.5 WHEN Split_Demo_Mode is enabled on a mobile or tablet viewport with width less than 1024px, THE System SHALL display a message indicating Split_Demo_Mode requires desktop viewport

12.6 THE System SHALL persist the Split_Demo_Mode state in Local_Storage with key "queueflow-split-mode"

12.7 WHEN the application initializes, THE System SHALL restore the Split_Demo_Mode state from Local_Storage

12.8 WHEN Split_Demo_Mode is enabled, THE System SHALL maintain Cross_Tab_Sync between the two displayed interfaces

### Requirement 13: Multi-Modal Notifications

**User Story:** As a visitor, I want to receive multiple types of notifications when my turn is approaching or called, so that I don't miss my turn regardless of what I'm doing.

#### Acceptance Criteria

13.1 WHEN a visitor's Queue_Position becomes 2 or less, THE System SHALL trigger a multi-modal notification

13.2 WHEN a visitor's token transitions to Called_State, THE System SHALL trigger a multi-modal notification

13.3 THE System SHALL generate an audio alert using Web Audio API with a 2-tone chime pattern without requiring external audio files

13.4 THE System SHALL use Web Audio API OscillatorNode to synthesize the first tone at 800 Hz for 200 milliseconds

13.5 THE System SHALL use Web Audio API OscillatorNode to synthesize the second tone at 1000 Hz for 200 milliseconds with a 100 millisecond gap after the first tone

13.6 IF the browser supports Notification API and permission is granted, THEN THE System SHALL display a browser notification with the visitor's token and queue status

13.7 THE System SHALL display an in-app toast notification with the visitor's token and status message

13.8 THE System SHALL request Notification API permission when the visitor first registers or when Split_Demo_Mode is enabled

13.9 IF Notification API permission is denied, THEN THE System SHALL display only the audio alert and in-app toast notification

13.10 THE System SHALL dismiss the in-app toast notification automatically after 5 seconds

13.11 THE System SHALL allow manual dismissal of the in-app toast notification before the automatic timeout

### Requirement 14: No-Show Management

**User Story:** As a service provider, I want to skip visitors who don't respond when called, so that I can maintain queue flow without blocking on no-shows.

#### Acceptance Criteria

14.1 WHEN a visitor is in Called_State, THE Provider_Console SHALL display a "No-Show / Skip" action button for that visitor

14.2 WHEN a service provider activates the No-Show action, THE System SHALL transition the visitor to No_Show_State

14.3 WHEN a visitor transitions to No_Show_State, THE System SHALL remove the visitor from the active queue

14.4 WHEN a visitor is marked as no-show, THE System SHALL recalculate Queue_Position for all remaining visitors in that service counter

14.5 WHEN a visitor transitions to No_Show_State, THE System SHALL broadcast the queue update to all open tabs via Cross_Tab_Sync

14.6 WHEN a visitor transitions to No_Show_State, THE System SHALL persist the updated queue state to Local_Storage

14.7 THE Provider_Console SHALL visually distinguish the No-Show action from the Complete action to prevent accidental activation

### Requirement 15: Counter Status Management

**User Story:** As a service provider, I want to pause and resume service at my counter, so that I can take breaks without affecting other counters.

#### Acceptance Criteria

15.1 THE Provider_Console SHALL provide an "Open / Pause Counter" toggle control for each Service_Counter

15.2 WHEN a Service_Counter is initialized, THE System SHALL set its Counter_Status to Open

15.3 WHEN a service provider toggles a counter to Paused status, THE Provider_Console SHALL disable the "Call Next" action for that Service_Counter

15.4 WHEN a Service_Counter is in Paused status, THE Provider_Console SHALL display a visual indicator showing the counter is paused

15.5 WHEN a service provider toggles a counter to Open status, THE Provider_Console SHALL enable the "Call Next" action for that Service_Counter

15.6 WHEN Counter_Status changes, THE System SHALL broadcast the status update to all open tabs via Cross_Tab_Sync

15.7 WHEN Counter_Status changes, THE System SHALL persist the updated status to Local_Storage

15.8 THE System SHALL store Counter_Status for each Service_Counter in Local_Storage key "queueflow-data"

15.9 WHEN the application initializes, THE System SHALL restore Counter_Status for each Service_Counter from Local_Storage

15.10 IF Local_Storage does not contain Counter_Status data, THEN THE System SHALL initialize all Service_Counters to Open status

15.11 WHEN a Service_Counter is in Paused status and has a visitor in Called_State, THE Provider_Console SHALL allow completion or no-show actions for that visitor
