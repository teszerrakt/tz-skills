# Invoices API handover

`GET /invoices` returns a list of invoices:

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `number` | string | e.g. `INV-0042` |
| `due_date` | string | ISO date, never null |
