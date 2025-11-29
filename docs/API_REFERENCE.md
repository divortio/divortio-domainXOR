# 🔌 API Reference

Divortio DomainXOR exposes a dual-mode interface: a **REST API** for external clients and an **RPC Interface** for internal Cloudflare Worker binding.

## REST API
The worker listens on standard HTTP(S) ports.

### Endpoint: `GET /`

Determines if a domain is blocked.

**Parameters:**

| Type | Key | Value | Priority |
| :--- | :--- | :--- | :--- |
| **Query** | `domain` | The domain to check (e.g., `?domain=ads.google.com`) | **High** |
| **Path** | `/{domain}` | The domain as the path (e.g., `/ads.google.com`) | Medium |
| **Host** | *Header* | The `Host` header of the request itself. | Low |

**Response:**
```json
{
  "domain": "ads.google.com",
  "blocked": true,
  "resolution_method": "query_param",
  "timestamp": "2025-11-26T19:50:00.000Z"
}
```
