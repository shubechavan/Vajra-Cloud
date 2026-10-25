
const express = require("express");

const app = express();

const PORT = Number(process.env.PORT || 3001);
const INSTANCE_ID = process.env.INSTANCE_ID || `worker-${PORT}`;

let requestCount = 0;

app.get("/", (req, res) => {
  requestCount++;

  res.json({
    project: "VAJRA CLOUD",
    instanceId: INSTANCE_ID,
    port: PORT,
    requestCount,
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({
    instanceId: INSTANCE_ID,
    status: "healthy"
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`${INSTANCE_ID} running on port ${PORT}`);
});
