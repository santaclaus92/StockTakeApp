import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const PORT = 4001;
const BASE = `http://localhost:${PORT}`;
const HEADERS = { 'X-Api-Key': 'test-api-key', 'Content-Type': 'application/json' };

let serverProcess;
let tmpDataDir;

describe('StockTake Pro API Server', () => {
  beforeAll(async () => {
    // Use a temp data dir so tests don't pollute the real data/ folder
    tmpDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stp-test-'));

    serverProcess = spawn('node', ['server.js'], {
      env: {
        ...process.env,
        PORT: String(PORT),
        API_KEY: 'test-api-key',
        ALLOWED_ORIGINS: '*',
        DATA_DIR: tmpDataDir,
      },
    });

    // Wait until server is ready
    await new Promise((resolve, reject) => {
      let retries = 0;
      const check = () => {
        const req = http.get(`${BASE}/api/warehouses`, {
          headers: { 'X-Api-Key': 'test-api-key' },
        }, (res) => {
          if (res.statusCode >= 200) resolve();
        });
        req.on('error', () => {
          if (++retries > 20) reject(new Error('Server failed to start'));
          else setTimeout(check, 150);
        });
      };
      check();
    });
  });

  afterAll(async () => {
    if (serverProcess) serverProcess.kill();
    if (tmpDataDir) await fs.rm(tmpDataDir, { recursive: true, force: true });
  });

  // ── Authentication ────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('rejects requests without API_KEY', async () => {
      const res = await fetch(`${BASE}/api/warehouses`);
      expect(res.status).toBe(401);
    });

    it('accepts requests with valid API_KEY', async () => {
      const res = await fetch(`${BASE}/api/warehouses`, { headers: HEADERS });
      expect(res.status).toBe(200);
    });

    it('returns 404 for unknown endpoints', async () => {
      const res = await fetch(`${BASE}/api/unknown-endpoint`, { headers: HEADERS });
      expect(res.status).toBe(404);
    });

    it('responds 204 to OPTIONS preflight', async () => {
      const res = await fetch(`${BASE}/api/items`, { method: 'OPTIONS', headers: HEADERS });
      expect(res.status).toBe(204);
    });
  });

  // ── Items CRUD ────────────────────────────────────────────────────────────

  describe('Items CRUD', () => {
    let createdId;

    it('GET /api/items returns an array', async () => {
      const res = await fetch(`${BASE}/api/items`, { headers: HEADERS });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('POST /api/items creates item and returns 201 with id', async () => {
      const res = await fetch(`${BASE}/api/items`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ code: 'TEST-001', name: 'Test Pump', uom: 'PCS' }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.code).toBe('TEST-001');
      createdId = data.id;
    });

    it('GET /api/items/:id returns the created item', async () => {
      const res = await fetch(`${BASE}/api/items/${createdId}`, { headers: HEADERS });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(createdId);
      expect(data.code).toBe('TEST-001');
    });

    it('PUT /api/items/:id updates a field and returns 200', async () => {
      const res = await fetch(`${BASE}/api/items/${createdId}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({ name: 'Updated Pump' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Updated Pump');
      expect(data.id).toBe(createdId);
    });

    it('DELETE /api/items/:id removes item and returns 200', async () => {
      const res = await fetch(`${BASE}/api/items/${createdId}`, {
        method: 'DELETE',
        headers: HEADERS,
      });
      expect(res.status).toBe(200);
    });

    it('GET /api/items/:id after delete returns 404', async () => {
      const res = await fetch(`${BASE}/api/items/${createdId}`, { headers: HEADERS });
      expect(res.status).toBe(404);
    });

    it('DELETE /api/items with no id returns 400', async () => {
      const res = await fetch(`${BASE}/api/items`, { method: 'DELETE', headers: HEADERS });
      expect(res.status).toBe(400);
    });

    it('PUT /api/items with no id returns 400', async () => {
      const res = await fetch(`${BASE}/api/items`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({ name: 'X' }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/items with invalid JSON returns 500', async () => {
      const res = await fetch(`${BASE}/api/items`, {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/json' },
        body: 'not-valid-json',
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('PATCH /api/items returns 405 method not allowed', async () => {
      const res = await fetch(`${BASE}/api/items`, { method: 'PATCH', headers: HEADERS });
      expect(res.status).toBe(405);
    });

    it('GET /api/items/:id for non-existent id returns 404', async () => {
      const res = await fetch(`${BASE}/api/items/nonexistent-id-xyz`, { headers: HEADERS });
      expect(res.status).toBe(404);
    });
  });

  // ── Users CRUD ────────────────────────────────────────────────────────────

  describe('Users CRUD', () => {
    let createdId;

    it('GET /api/users returns array with default users', async () => {
      const res = await fetch(`${BASE}/api/users`, { headers: HEADERS });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('POST /api/users creates user with generated id', async () => {
      const res = await fetch(`${BASE}/api/users`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ name: 'Test User', role: 'counter' }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test User');
      createdId = data.id;
    });

    it('PUT /api/users/:id updates name field', async () => {
      const res = await fetch(`${BASE}/api/users/${createdId}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({ name: 'Renamed User' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Renamed User');
    });

    it('DELETE /api/users/:id removes user', async () => {
      const res = await fetch(`${BASE}/api/users/${createdId}`, {
        method: 'DELETE',
        headers: HEADERS,
      });
      expect(res.status).toBe(200);
    });
  });

  // ── Warehouses CRUD + Import ──────────────────────────────────────────────

  describe('Warehouses CRUD + Import', () => {
    it('GET /api/warehouses returns array', async () => {
      const res = await fetch(`${BASE}/api/warehouses`, { headers: HEADERS });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('POST /api/warehouses/import with valid array returns 200 with count', async () => {
      const payload = [
        { id: 'WH-01', name: 'North Yard' },
        { id: 'WH-02', name: 'South Yard' },
      ];
      const res = await fetch(`${BASE}/api/warehouses/import`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(payload),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.imported).toBe(2);
      expect(Array.isArray(data.warehouses)).toBe(true);
    });

    it('POST /api/warehouses/import with non-array body returns 400', async () => {
      const res = await fetch(`${BASE}/api/warehouses/import`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ notAnArray: true }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/warehouses/import normalises entries — falls back id to name', async () => {
      const res = await fetch(`${BASE}/api/warehouses/import`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify([{ name: 'Only Name Warehouse' }]),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      const wh = data.warehouses[0];
      expect(wh.name).toBe('Only Name Warehouse');
      expect(wh.id).toBeDefined();
    });

    it('POST /api/warehouses creates a single warehouse', async () => {
      const res = await fetch(`${BASE}/api/warehouses`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ id: 'WH-99', name: 'Test Warehouse' }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe('WH-99');
    });
  });

  // ── Data round-trip: POST input → GET fetch → verify exact fields ─────────

  describe('Data round-trip — POST then GET verifies all fields persisted', () => {
    it('all item fields survive the write → read cycle', async () => {
      const input = {
        code: 'RT-001',
        name: 'Round-Trip Pump',
        group: 'Machinery',
        batch: 'BT-2025-RT',
        uom: 'PCS',
        warehouse: 'A-07',
        sapQty: 100,
        countQty: 98,
        pairId: 'P01',
        status: 'active',
        entity: 'BMS',
        wh_code: 'KL01',
      };

      const post = await fetch(`${BASE}/api/items`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(input),
      });
      expect(post.status).toBe(201);
      const created = await post.json();
      const id = created.id;

      const get = await fetch(`${BASE}/api/items/${id}`, { headers: HEADERS });
      expect(get.status).toBe(200);
      const fetched = await get.json();

      // Every field we sent must survive the round-trip
      expect(fetched.code).toBe(input.code);
      expect(fetched.name).toBe(input.name);
      expect(fetched.group).toBe(input.group);
      expect(fetched.batch).toBe(input.batch);
      expect(fetched.uom).toBe(input.uom);
      expect(fetched.warehouse).toBe(input.warehouse);
      expect(fetched.sapQty).toBe(input.sapQty);
      expect(fetched.countQty).toBe(input.countQty);
      expect(fetched.entity).toBe(input.entity);
      expect(fetched.wh_code).toBe(input.wh_code);

      // Cleanup
      await fetch(`${BASE}/api/items/${id}`, { method: 'DELETE', headers: HEADERS });
    });

    it('partial PUT preserves fields that were not updated', async () => {
      // Input: full item
      const post = await fetch(`${BASE}/api/items`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ code: 'RT-002', name: 'Original Name', sapQty: 50, entity: 'BMS' }),
      });
      const { id } = await post.json();

      // Update only countQty — other fields must be preserved
      await fetch(`${BASE}/api/items/${id}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({ countQty: 47 }),
      });

      const get = await fetch(`${BASE}/api/items/${id}`, { headers: HEADERS });
      const fetched = await get.json();

      expect(fetched.countQty).toBe(47);           // updated
      expect(fetched.code).toBe('RT-002');          // preserved
      expect(fetched.name).toBe('Original Name');   // preserved
      expect(fetched.sapQty).toBe(50);              // preserved
      expect(fetched.entity).toBe('BMS');           // preserved

      await fetch(`${BASE}/api/items/${id}`, { method: 'DELETE', headers: HEADERS });
    });

    it('batch POST of multiple items — all are fetchable individually', async () => {
      const batch = [
        { code: 'BATCH-A', name: 'Item A', entity: 'BMS' },
        { code: 'BATCH-B', name: 'Item B', entity: 'BMS' },
        { code: 'BATCH-C', name: 'Item C', entity: 'BMSG' },
      ];

      const post = await fetch(`${BASE}/api/items`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(batch),
      });
      expect(post.status).toBe(201);
      const created = await post.json();
      expect(Array.isArray(created)).toBe(true);
      expect(created).toHaveLength(3);

      // Each item is individually fetchable with correct fields
      for (const item of created) {
        const get = await fetch(`${BASE}/api/items/${item.id}`, { headers: HEADERS });
        expect(get.status).toBe(200);
        const fetched = await get.json();
        expect(fetched.id).toBe(item.id);
        expect(fetched.code).toBe(item.code);
        expect(fetched.entity).toBe(item.entity);
        await fetch(`${BASE}/api/items/${item.id}`, { method: 'DELETE', headers: HEADERS });
      }
    });

    it('GET all items includes the newly posted item', async () => {
      const listBefore = await (await fetch(`${BASE}/api/items`, { headers: HEADERS })).json();

      const post = await fetch(`${BASE}/api/items`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ code: 'RT-LIST', name: 'List Test Item' }),
      });
      const { id } = await post.json();

      const listAfter = await (await fetch(`${BASE}/api/items`, { headers: HEADERS })).json();
      expect(listAfter.length).toBe(listBefore.length + 1);
      expect(listAfter.some(i => i.id === id)).toBe(true);

      await fetch(`${BASE}/api/items/${id}`, { method: 'DELETE', headers: HEADERS });
    });

    it('DELETE removes item from GET all list', async () => {
      const post = await fetch(`${BASE}/api/items`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ code: 'RT-DEL', name: 'To Be Deleted' }),
      });
      const { id } = await post.json();

      await fetch(`${BASE}/api/items/${id}`, { method: 'DELETE', headers: HEADERS });

      const list = await (await fetch(`${BASE}/api/items`, { headers: HEADERS })).json();
      expect(list.some(i => i.id === id)).toBe(false);
    });
  });
});
