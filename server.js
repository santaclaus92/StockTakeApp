const http = require('http');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs/promises');

const PORT = process.env.PORT || 4000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
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
        warehouse: 'A-07',
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
        warehouse: 'B-04',
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
  warehouses: {
    file: 'warehouses.json',
    defaults: []
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

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:4000').split(',').map(o => o.trim());
const API_KEY = process.env.API_KEY || '';

const setCors = (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Api-Key');
};

const send = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const server = http.createServer(async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // API key guard — skip for OPTIONS (already returned above)
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    return send(res, 401, { message: 'Unauthorized: missing or invalid X-Api-Key header' });
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const segments = url.pathname.split('/').filter(Boolean);

  if (segments[0] !== 'api') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('StockTake Pro API is running. Use /api/items, /api/users, /api/warehouses.');
  }

  const resource = segments[1];
  const id = segments[2];
  const action = segments[3]; // e.g. /api/warehouses/import
  const collection = RESOURCES[resource];

  // POST /api/warehouses/import — replace all warehouse records with incoming JSON array
  if (resource === 'warehouses' && id === 'import' && req.method === 'POST') {
    try {
      const payload = await parseBody(req);
      if (!Array.isArray(payload)) {
        return send(res, 400, { message: 'Import expects a JSON array of warehouse objects' });
      }
      const normalised = payload.map((w) => ({
        id: w.id || w.code || w.name,
        name: w.name || w.id || w.code || '',
        shelves: Array.isArray(w.shelves) ? w.shelves : [],
        ...w
      }));
      await writeResource('warehouses', normalised);
      return send(res, 200, { imported: normalised.length, warehouses: normalised });
    } catch (err) {
      return send(res, 500, { message: 'Import failed', details: err.message });
    }
  }

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
