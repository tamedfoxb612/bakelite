const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.static(__dirname));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Simple relay endpoint
let relayEvents = [];
app.get('/api/relay', (req, res) => {
  const room = req.query.room;
  const since = parseInt(req.query.since || '0', 10);
  const events = relayEvents.filter(e => e.room === room && e.id > since);
  res.json(events);
});

app.post('/api/relay', (req, res) => {
  const room = req.query.room;
  const payload = req.body;
  if (!payload.id) payload.id = Date.now();
  payload.room = room;
  relayEvents.push(payload);
  if (relayEvents.length > 1000) relayEvents.shift();
  res.json({ success: true });
});



app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
