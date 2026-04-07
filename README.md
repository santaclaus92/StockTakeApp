

---

## Local API Server (development only)

```
node server.js          # default port 4000, override with PORT=xxxx
```

| Endpoint | Description |
|---|---|
| `GET /api/items\|users\|warehouses` | List all records |
| `GET /api/{resource}/{id}` | Get one record |
| `POST /api/{resource}` | Append records (object or array) |
| `PUT /api/{resource}/{id}` | Update a record |
| `DELETE /api/{resource}/{id}` | Delete a record |
| `POST /api/warehouses/import` | Replace all warehouse records |

Data is persisted in `data/items.json`, `data/users.json`, `data/warehouses.json`.

---

## Supabase Schema

Run `data/schema.sql` in the Supabase SQL Editor to create/migrate all tables:

- `sessions` — stock-take sessions
- `pairs` — counter/checker pairs per session
- `items` — item master with count data
- `users` — staff imported from Azure AD via Power Automate
- `warehouses` — bin/location list synced from Power Automate webhook
- `session_attendees` — attendance tracking per session
- `item_audit` — audit trail of every count submission (who, what qty, when)
