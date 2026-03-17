const http = require('http');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs/promises');

const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, 'data');
const RESOURCES = {
  items: {
    file: 'items.json',
    defaults: [
      {
        id: 'ITM-001234',
        code: 'ITM-001234',
        name: 'Hydraulic Pump A200',
        group: 'Machinery',
        batch: 'BT-2024-001',
        uom: 'PCS',
        bin: 'A-07',
        sapQty: 50,
        countQty: 50,
        pairId: 'P01',
        status: 'active'
      },
      {
        id: 'ITM-001235',
        code: 'ITM-001235',
        name: 'Conveyor Belt 5m',
        group: 'Hardware',
        batch: '—',
        uom: 'MTR',
        bin: 'B-04',
        sapQty: 12,
        countQty: 9,
        pairId: 'P02',
        status: 'active'
      }
    ]
  },
  users: {
    file: 'users.json',
    defaults: [
      { id: 'U001', name: 'Ahmad Hassan', role: 'counter', team: 'North Yard' },
      { id: 'U002', name: 'Siti Che', role: 'checker', team: 'North Yard' },
      { id: 'U003', name: 'Jarvis Ng', role: 'counter', team: 'South Yard' }
    ]
  },
  bins: {
    file: 'bins.json',
    defaults: [
      { id: 'A-01', zone: 'A', level: 1, capacity: 20 },
      { id: 'B-04', zone: 'B', level: 1, capacity: 30 },
      { id: 'D-09', zone: 'D', level: 2, capacity: 18 }
    ]
  }
};

const ensureDataDir = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await Promise.all(
      Object.entries(RESOURCES).map(async ([key, { file, defaults }]) => {
        const filePath = path.join(DATA_DIR, file);
        try {
          await fs.access(filePath);
        } catch {
          await fs.writeFile(filePath, JSON.stringify(defaults, null, 2));
        }
      })
    );
  } catch (error) {
    console.error('Failed to prepare data directory:', error);
    throw error;
  }
};

const readResource = async (resource) => {
  const entry = RESOURCES[resource];
  if (!entry) return null;
  const filePath = path.join(DATA_DIR, entry.file);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

const writeResource = async (resource, payload) => {
  const entry = RESOURCES[resource];
  if (!entry) return null;
  const filePath = path.join(DATA_DIR, entry.file);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
  return payload;
};

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.connection.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve(null);
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });

const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const send = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const segments = url.pathname.split('/').filter(Boolean);

  if (segments[0] !== 'api') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('StockTake Pro API is running. Use /api/items, /api/users, /api/bins.');
  }

  const resource = segments[1];
  const id = segments[2];
  const collection = RESOURCES[resource];

  if (!collection) {
    return send(res, 404, { message: `Unknown resource: ${resource}` });
  }

  try {
    let data = await readResource(resource);
    switch (req.method) {
      case 'GET':
        if (id) {
          const item = data.find((entry) => entry.id === id);
          if (!item) return send(res, 404, { message: `${resource} ${id} not found` });
          return send(res, 200, item);
        }
        return send(res, 200, data);
      case 'POST': {
        const payload = await parseBody(req);
        if (!payload || typeof payload !== 'object') {
          return send(res, 400, { message: 'POST requires a JSON object' });
        }
        const next = Array.isArray(payload) ? payload : [payload];
        const inserted = next.map((entry) => ({
          id: entry.id || randomUUID(),
          ...entry,
          createdAt: entry.createdAt || new Date().toISOString()
        }));
        data = [...data, ...inserted];
        await writeResource(resource, data);
        return send(res, 201, inserted.length === 1 ? inserted[0] : inserted);
      }
      case 'PUT': {
        if (!id) return send(res, 400, { message: 'PUT requires an id in the path' });
        const payload = await parseBody(req);
        if (!payload || typeof payload !== 'object') {
          return send(res, 400, { message: 'PUT requires a JSON object payload' });
        }
        let updated;
        data = data.map((entry) => {
          if (entry.id === id) {
            updated = { ...entry, ...payload, id };
            return updated;
          }
          return entry;
        });
        if (!updated) {
          return send(res, 404, { message: `${resource} ${id} not found` });
        }
        await writeResource(resource, data);
        return send(res, 200, updated);
      }
      case 'DELETE': {
        if (!id) return send(res, 400, { message: 'DELETE requires an id' });
        const before = data.length;
        data = data.filter((entry) => entry.id !== id);
        if (data.length === before) {
          return send(res, 404, { message: `${resource} ${id} not found` });
        }
        await writeResource(resource, data);
        return send(res, 200, { message: `${resource} ${id} removed` });
      }
      default:
        return send(res, 405, { message: 'Method not allowed' });
    }
  } catch (error) {
    console.error(error);
    return send(res, 500, { message: 'Server error', details: error.message });
  }
});

ensureDataDir()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`API server listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
