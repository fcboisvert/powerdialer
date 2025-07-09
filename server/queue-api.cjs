// queue-api.js

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

// Simple in-memory queue (replace with DB for production)
let queue = [];

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 1. Webhook receiver for Make.com/Airtable
app.post("/api/queue", (req, res) => {
    const record = req.body;
    // Basic validation
    if (!record || !record.recordId || !record.agent || !record.phone) {
        return res.status(400).json({ error: "Missing required fields: recordId, agent, phone." });
    }
    // Prevent duplicates (by recordId)
    if (queue.some(item => item.recordId === record.recordId)) {
        return res.status(200).json({ status: "Already queued." });
    }
    queue.push({ ...record, status: "queued", createdAt: new Date().toISOString() });
    console.log(`Queued: ${record.recordId} for ${record.agent}`);
    res.status(201).json({ status: "Queued", length: queue.length });
});

// 2. Endpoint for frontend to fetch the queue (optionally, filter by agent)
app.get("/api/queue", (req, res) => {
    const { agent } = req.query;
    let result = queue;
    if (agent) {
        result = queue.filter(item => item.agent === agent && item.status === "queued");
    } else {
        result = queue.filter(item => item.status === "queued");
    }
    res.json(result);
});

// 3. Endpoint to update queue status (after call is done)
app.post("/api/queue/:recordId/done", (req, res) => {
    const { recordId } = req.params;
    const { outcome, notes } = req.body;
    const idx = queue.findIndex(item => item.recordId === recordId);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    queue[idx].status = "done";
    queue[idx].outcome = outcome || null;
    queue[idx].notes = notes || null;
    queue[idx].completedAt = new Date().toISOString();
    res.json({ status: "Updated" });
});

// 4. (Optional) Clear the queue for dev/testing
app.post("/api/queue/clear", (req, res) => {
    queue = [];
    res.json({ status: "Cleared" });
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Queue API listening on port ${PORT}`));
