const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, "queue-data.json");

app.use(cors());
app.use(express.json());

// SSE clients
let sseClients = [];

// Load or initialize data
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Error loading data:", err);
  }
  return initializeDefaultState();
}

function initializeDefaultState() {
  const queues = {};
  const bankCounters = [
    { name: "Teller Services", code: "T", avgServiceTime: 4 },
    { name: "Account Opening", code: "A", avgServiceTime: 12 },
    { name: "Loan & Investment", code: "L", avgServiceTime: 15 }
  ];
  
  bankCounters.forEach(counter => {
    queues[counter.name] = {
      serviceCounter: counter.name,
      code: counter.code,
      avgServiceTime: counter.avgServiceTime,
      status: "open",
      visitors: [],
      nextTokenNumber: 1
    };
  });

  // Seed demo data
  const demoVisitors = [
    { name: "Alice Johnson", counter: "Teller Services", priority: "Normal" },
    { name: "Bob Smith", counter: "Teller Services", priority: "Urgent" },
    { name: "Carol White", counter: "Account Opening", priority: "Normal" },
    { name: "David Brown", counter: "Loan & Investment", priority: "Normal" },
    { name: "Emma Davis", counter: "Teller Services", priority: "Normal" },
  ];

  let idCounter = 1;
  demoVisitors.forEach((demo, index) => {
    const queue = queues[demo.counter];
    if (!queue) return;

    const visitor = {
      id: `demo-${idCounter++}`,
      token: `${queue.code}-${queue.nextTokenNumber.toString().padStart(5, "0")}`,
      serviceCounter: demo.counter,
      counterCode: queue.code,
      priority: demo.priority,
      registeredAt: Date.now() - (5 - index) * 60000,
      status: index === 0 ? "called" : "waiting",
      position: 0
    };
    queue.visitors.push(visitor);
    queue.nextTokenNumber++;
  });

  // Recalculate positions
  Object.values(queues).forEach(recalculatePositions);

  return {
    queues,
    splitDemoMode: false,
    currentDomain: "bank"
  };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error saving data:", err);
  }
}

function sortQueue(visitors) {
  return [...visitors].sort((a, b) => {
    const priorityOrder = { Urgent: 0, Normal: 1 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.registeredAt - b.registeredAt;
  });
}

function recalculatePositions(queue) {
  const activeVisitors = queue.visitors.filter(v => v.status !== "completed" && v.status !== "no-show");
  const sorted = sortQueue(activeVisitors);
  sorted.forEach((visitor, index) => {
    visitor.position = index + 1;
  });
}

function broadcastUpdate(state) {
  const data = JSON.stringify(state);
  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error("Error broadcasting to client:", err);
    }
  });
}

let state = loadData();

// Routes
app.get("/api/state", (req, res) => {
  res.json(state);
});

app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = Date.now();
  const client = { id: clientId, res };
  sseClients.push(client);

  // Send initial state
  res.write(`data: ${JSON.stringify(state)}\n\n`);

  req.on("close", () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

app.post("/api/join", (req, res) => {
  const { serviceCounter, priority, name } = req.body;
  const queue = state.queues[serviceCounter];
  
  if (!queue) {
    return res.status(404).json({ error: "Queue not found" });
  }

  const visitor = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    token: `${queue.code}-${queue.nextTokenNumber.toString().padStart(5, "0")}`,
    serviceCounter,
    counterCode: queue.code,
    priority: priority || "Normal",
    registeredAt: Date.now(),
    status: "waiting",
    position: 0
  };

  queue.visitors.push(visitor);
  queue.nextTokenNumber++;
  recalculatePositions(queue);

  saveData(state);
  broadcastUpdate(state);
  
  res.json(visitor);
});

app.post("/api/leave", (req, res) => {
  const { visitorId } = req.body;
  
  for (const queueName in state.queues) {
    const queue = state.queues[queueName];
    const visitor = queue.visitors.find(v => v.id === visitorId);
    
    if (visitor) {
      visitor.status = "completed";
      recalculatePositions(queue);
      saveData(state);
      broadcastUpdate(state);
      return res.json({ success: true });
    }
  }
  
  res.status(404).json({ error: "Visitor not found" });
});

app.post("/api/call-next", (req, res) => {
  const { serviceCounter } = req.body;
  const queue = state.queues[serviceCounter];
  
  if (!queue) {
    return res.status(404).json({ error: "Queue not found" });
  }

  if (queue.status === "paused") {
    return res.status(400).json({ error: "Counter is paused" });
  }

  // Check if someone is already being served
  const calledVisitor = queue.visitors.find(v => v.status === "called");
  if (calledVisitor) {
    return res.status(400).json({ error: "A visitor is already being served" });
  }

  const activeVisitors = queue.visitors.filter(v => v.status !== "completed" && v.status !== "no-show");
  const sorted = sortQueue(activeVisitors);
  const nextVisitor = sorted.find(v => v.status === "waiting" || v.status === "approaching");
  
  if (!nextVisitor) {
    return res.status(404).json({ error: "No visitors waiting" });
  }

  nextVisitor.status = "called";

  saveData(state);
  broadcastUpdate(state);
  
  res.json(nextVisitor);
});

app.post("/api/complete", (req, res) => {
  const { visitorId } = req.body;
  
  for (const queueName in state.queues) {
    const queue = state.queues[queueName];
    const visitor = queue.visitors.find(v => v.id === visitorId);
    
    if (visitor) {
      visitor.status = "completed";
      recalculatePositions(queue);
      
      // Check for approaching visitors
      queue.visitors.forEach(v => {
        if (v.position <= 2 && v.status === "waiting") {
          v.status = "approaching";
        }
      });

      saveData(state);
      broadcastUpdate(state);
      return res.json({ success: true });
    }
  }
  
  res.status(404).json({ error: "Visitor not found" });
});

app.post("/api/no-show", (req, res) => {
  const { visitorId } = req.body;
  
  for (const queueName in state.queues) {
    const queue = state.queues[queueName];
    const visitor = queue.visitors.find(v => v.id === visitorId);
    
    if (visitor) {
      visitor.status = "no-show";
      recalculatePositions(queue);
      
      saveData(state);
      broadcastUpdate(state);
      return res.json({ success: true });
    }
  }
  
  res.status(404).json({ error: "Visitor not found" });
});

app.post("/api/toggle-counter", (req, res) => {
  const { serviceCounter } = req.body;
  const queue = state.queues[serviceCounter];
  
  if (!queue) {
    return res.status(404).json({ error: "Queue not found" });
  }

  queue.status = queue.status === "open" ? "paused" : "open";
  
  saveData(state);
  broadcastUpdate(state);
  
  res.json({ status: queue.status });
});

app.post("/api/reset", (req, res) => {
  state = initializeDefaultState();
  saveData(state);
  broadcastUpdate(state);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`QueueFlow backend running on http://localhost:${PORT}`);
  console.log(`SSE stream available at http://localhost:${PORT}/api/stream`);
});