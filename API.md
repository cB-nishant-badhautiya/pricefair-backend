# PriceFair API

Base URL: `http://localhost:5000/api` (or your deployed backend URL).

All responses are JSON.

---

## 1. Run a price check

**POST** `/api/check`

Analyzes a product, hotel, or flight for price fairness. Send either a **URL** (to scrape) or **pasted text** (name + price), or both. Optionally set `type` to `product`, `hotel`, or `flight`; otherwise it is auto-detected.

### Request body

| Field        | Type   | Required | Description                                      |
|-------------|--------|----------|--------------------------------------------------|
| `url`       | string | No       | Product/hotel/flight page URL (Amazon, Flipkart, etc.) |
| `pastedText`| string | No       | Pasted listing text (e.g. product name and price)     |
| `type`      | string | No       | `"product"` \| `"hotel"` \| `"flight"` — overrides auto-detect |

At least one of `url` or `pastedText` must be provided. If both are sent, the URL is scraped first; pasted text can be used as fallback.

### Example: URL only

```bash
curl -X POST http://localhost:5000/api/check \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.amazon.in/dp/B0CX1F1ABC"
  }'
```

### Example: Pasted text only

```bash
curl -X POST http://localhost:5000/api/check \
  -H "Content-Type: application/json" \
  -d '{
    "pastedText": "Samsung Galaxy M34 5G\n₹ 18,999"
  }'
```

### Example: URL + type (e.g. hotel)

```bash
curl -X POST http://localhost:5000/api/check \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.booking.com/hotel/in/example.html",
    "type": "hotel"
  }'
```

### Success response (200)

```json
{
  "success": true,
  "id": "clxx1abc0000xyz",
  "type": "product",
  "source": "Amazon",
  "title": "Samsung Galaxy M34 5G (Midnight Blue, 8GB, 128GB Storage)",
  "currentPrice": 18999,
  "currency": "INR",
  "fairPriceLow": 17500,
  "fairPriceHigh": 19500,
  "surgeScore": 25,
  "recommendation": "buy_now",
  "confidenceScore": 72,
  "insightSummary": "Current price sits within the estimated fair range. Minor discount vs typical listing.",
  "bestTimeToBuy": "Current price is reasonable; no need to wait.",
  "reasons": [
    "Price within expected band for this segment",
    "No strong surge signals"
  ]
}
```

### Error response (400)

When no valid price could be determined (e.g. scrape failed and no pasted price):

```json
{
  "success": false,
  "error": "Could not determine a valid price. Please provide a URL or paste product/price details."
}
```

### Server error (500)

```json
{
  "success": false,
  "error": "Analysis failed"
}
```

---

## 2. Get recent checks (history)

**GET** `/api/history`

Returns the list of recent price checks, newest first.

### Query parameters

| Parameter | Type   | Default | Description                |
|----------|--------|---------|----------------------------|
| `limit`  | number | 20      | Number of records (max 50) |

### Example

```bash
curl "http://localhost:5000/api/history?limit=10"
```

### Response (200)

```json
[
  {
    "id": "clxx1abc0000xyz",
    "type": "product",
    "sourceName": "Amazon",
    "title": "Samsung Galaxy M34 5G (Midnight Blue, 8GB, 128GB Storage)",
    "currentPrice": 18999,
    "surgeScore": 25,
    "recommendation": "buy_now",
    "confidenceScore": 72,
    "createdAt": "2025-01-15T10:30:00.000Z"
  },
  {
    "id": "clxx1abc0000abc",
    "type": "flight",
    "sourceName": "Pasted",
    "title": "Delhi to Mumbai",
    "currentPrice": 4500,
    "surgeScore": 60,
    "recommendation": "wait",
    "confidenceScore": 55,
    "createdAt": "2025-01-15T09:15:00.000Z"
  }
]
```

---

## 3. Get a single check by ID

**GET** `/api/check/:id`

Returns the full record for one price check (including stored AI analysis).

### Example

```bash
curl "http://localhost:5000/api/check/clxx1abc0000xyz"
```

### Response (200)

```json
{
  "id": "clxx1abc0000xyz",
  "type": "product",
  "sourceUrl": "https://www.amazon.in/dp/B0CX1F1ABC",
  "sourceName": "Amazon",
  "title": "Samsung Galaxy M34 5G (Midnight Blue, 8GB, 128GB Storage)",
  "currentPrice": 18999,
  "currency": "INR",
  "rawInput": null,
  "fairPriceLow": 17500,
  "fairPriceHigh": 19500,
  "surgeScore": 25,
  "recommendation": "buy_now",
  "confidenceScore": 72,
  "insightSummary": "Current price sits within the estimated fair range.",
  "fullAnalysis": "{\"fairPriceLow\":17500,\"fairPriceHigh\":19500,\"surgeScore\":25,\"recommendation\":\"buy_now\",\"confidenceScore\":72,\"insightSummary\":\"...\",\"bestTimeToBuy\":\"...\",\"reasons\":[...]}",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

### Not found (404)

```json
{
  "error": "Not found"
}
```

---

## Health check

**GET** `/health`

Quick liveness check (no auth).

```bash
curl http://localhost:5000/health
```

```json
{
  "ok": true
}
```
