const express = require("express");
const crypto = require("crypto");

const app = express();

const PORT = Number(process.env.PORT || 3001);
const INSTANCE_ID = process.env.INSTANCE_ID || `worker-${PORT}`;

// Cumulative counters — the backend polls /stats and computes deltas
let requestCount = 0;
let totalLatencyMs = 0;

// Count every request except the monitoring endpoints themselves
app.use((req, res, next) => {
  if (req.path === "/stats" || req.path === "/health") return next();

  const start = process.hrtime.bigint();
  res.on("finish", () => {
    requestCount++;
    totalLatencyMs += Number(process.hrtime.bigint() - start) / 1e6;
  });
  next();
});

app.get("/", (req, res) => {
  res.json({
    project: "VAJRA CLOUD",
    instanceId: INSTANCE_ID,
    port: PORT,
    requestCount,
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// CPU-bound endpoint used by the stress test: hashes for ?ms= milliseconds.
// This burns REAL CPU inside this worker process.
app.get("/work", (req, res) => {
  const ms = Math.min(Math.max(Number(req.query.ms) || 40, 1), 500);
  const end = Date.now() + ms;
  let hash = INSTANCE_ID;
  let rounds = 0;

  while (Date.now() < end) {
    hash = crypto.createHash("sha256").update(hash).digest("hex");
    rounds++;
  }

  res.json({ instanceId: INSTANCE_ID, port: PORT, workMs: ms, rounds });
});

app.get("/health", (req, res) => {
  res.json({
    instanceId: INSTANCE_ID,
    status: "healthy"
  });
});

// Polled by the backend's traffic monitor
app.get("/stats", (req, res) => {
  const cpu = process.cpuUsage();
  res.json({
    instanceId: INSTANCE_ID,
    requestCount,
    totalLatencyMs,
    cpuMicros: cpu.user + cpu.system,
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    uptimeSec: Math.round(process.uptime())
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`${INSTANCE_ID} running on port ${PORT}`);
});
