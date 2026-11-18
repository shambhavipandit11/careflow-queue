import type { Domain } from "../types";

export const DOMAINS: Domain[] = [
  {
    id: "bank",
    name: "Bank Branch",
    icon: "Landmark",
    counters: [
      { name: "Teller Services", code: "T", avgServiceTime: 4 },
      { name: "Account Opening", code: "A", avgServiceTime: 12 },
      { name: "Loan & Investment", code: "L", avgServiceTime: 15 }
    ]
  },
  {
    id: "railway",
    name: "Railway Station",
    icon: "Train",
    counters: [
      { name: "Ticket Booking", code: "B", avgServiceTime: 3 },
      { name: "Refund & Cancellation", code: "R", avgServiceTime: 6 },
      { name: "Inquiry & PNR", code: "I", avgServiceTime: 2 }
    ]
  },
  {
    id: "hospital",
    name: "Hospital OPD",
    icon: "Stethoscope",
    counters: [
      { name: "General Consultation", code: "G", avgServiceTime: 8 },
      { name: "Emergency Care", code: "E", avgServiceTime: 5 },
      { name: "Pharmacy Counter", code: "P", avgServiceTime: 3 }
    ]
  },
  {
    id: "repair",
    name: "Repair Service Center",
    icon: "Wrench",
    counters: [
      { name: "Device Diagnostics", code: "D", avgServiceTime: 10 },
      { name: "Quick Fix Counter", code: "Q", avgServiceTime: 5 },
      { name: "Parts & Warranty", code: "W", avgServiceTime: 7 }
    ]
  }
];

export const DEMO_VISITORS = {
  bank: [
    { name: "Alice Johnson", counter: "Teller Services", priority: "Normal" as const },
    { name: "Bob Smith", counter: "Teller Services", priority: "Urgent" as const },
    { name: "Carol White", counter: "Account Opening", priority: "Normal" as const },
    { name: "David Brown", counter: "Loan & Investment", priority: "Normal" as const },
    { name: "Emma Davis", counter: "Teller Services", priority: "Normal" as const },
  ],
  railway: [
    { name: "Rajesh Kumar", counter: "Ticket Booking", priority: "Normal" as const },
    { name: "Priya Sharma", counter: "Ticket Booking", priority: "Urgent" as const },
    { name: "Amit Patel", counter: "Refund & Cancellation", priority: "Normal" as const },
    { name: "Sneha Gupta", counter: "Inquiry & PNR", priority: "Normal" as const },
    { name: "Vikram Singh", counter: "Ticket Booking", priority: "Normal" as const },
  ],
  hospital: [
    { name: "John Martinez", counter: "General Consultation", priority: "Normal" as const },
    { name: "Sarah Lee", counter: "Emergency Care", priority: "Urgent" as const },
    { name: "Michael Chen", counter: "Pharmacy Counter", priority: "Normal" as const },
    { name: "Lisa Anderson", counter: "General Consultation", priority: "Normal" as const },
    { name: "James Taylor", counter: "General Consultation", priority: "Normal" as const },
  ],
  repair: [
    { name: "Alex Rodriguez", counter: "Device Diagnostics", priority: "Normal" as const },
    { name: "Maria Garcia", counter: "Quick Fix Counter", priority: "Urgent" as const },
    { name: "Kevin Wilson", counter: "Parts & Warranty", priority: "Normal" as const },
    { name: "Jessica Moore", counter: "Device Diagnostics", priority: "Normal" as const },
    { name: "Daniel Thompson", counter: "Quick Fix Counter", priority: "Normal" as const },
  ]
};
