# StockTake Pro API

- **Server**: `node server.js` (default port `4000`, configurable via `PORT`)
- **Storage**: JSON files in `data/` act as lightweight persistence for `items`, `users`, and `bins`. Each resource exposes `id` for PK-style operations.
- **Endpoints**
  * `GET /api/items|users|bins` — list the entire collection.
  * `GET /api/{resource}/{id}` — retrieve one document.
  * `POST /api/{resource}` — append new entries (single object or array). Example body:
    ```json
    {
      "code": "ITM-005555",
      "name": "Chain Hoist",
      "group": "Lifting",
      "bin": "C-03",
      "sapQty": 12,
      "countQty": 0,
      "status": "active"
    }
    ```
  * `PUT /api/{resource}/{id}` — update fields for an existing entry.
  * `DELETE /api/{resource}/{id}` — remove entry by `id`.

- **Integration notes**
  * CORS headers are already configured so your frontend can hit the API from any origin.
  * To seed new data from the UI, POST to `/api/items`, `/api/users`, or `/api/bins`.
  * All responses are JSON; errors include a `message` property and (when available) `details`.

Feel free to wire this API behind your modernized HTML by updating the fetch calls in your scripts and pointing them at `http://localhost:4000/api/...`.
