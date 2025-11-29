# Divortio DomainXOR

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)
![Performance](https://img.shields.io/badge/throughput-1.5M%20ops%2Fsec-blueviolet)
![Size](https://img.shields.io/badge/size-2.4MB-blue)

A high-performance, zero-allocation domain blocklist service running on Cloudflare Workers. It uses a **Probabilistic Hybrid Filter** (XOR Filter + Binary Trie) to compress millions of domains into a tiny memory footprint with sub-microsecond lookup speeds.

> **Performance:** 1,500,000+ lookups/second on legacy hardware.  
> **Size:** ~2.4MB for ~1.6 Million rules (covering millions of subdomains).

## 🚀 Features

* **Zero-Allocation Runtime:** Designed to avoid Garbage Collection pauses. Uses `Uint8Array` and integer math exclusively in the hot path.
* **Hybrid Architecture:**
    * **Exact Match:** 8-bit XOR Filter for instant $O(1)$ checks.
    * **Wildcard Support:** Blocks `*.example.com` without blocking `example.com.uk`.
    * **PSL Aware:** Uses a Binary Trie to respect Public Suffix boundaries (never blocks `*.co.uk`).
* **100% Coverage:** Automated build pipeline verifies every single rule against the generated binary.
* **Universal API:** Works as a REST API or an internal RPC Service (Service Bindings).

## 🛠️ Build & Usage

### Prerequisites
* Node.js v20+

### Quick Start
1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Build Artifacts:**
    Fetches lists (OISD, EasyPrivacy, etc.), parses, and generates binaries.
    ```bash
    npm run build
    ```
3.  **Run Tests:**
    Validates math, logic, and 100% block coverage.
    ```bash
    npm test
    ```
4.  **Deploy:**
    ```bash
    npm run deploy
    ```

### API

**Check a Domain:**
`GET /?domain=ads.google.com`

```json
{
  "domain": "ads.google.com",
  "blocked": true,
  "resolution_method": "query_param",
  "timestamp": "2025-11-26T20:00:00.000Z"
}
````

## 📚 Documentation

* **[Benchmarks](https://www.google.com/search?q=docs/BENCHMARKS.md):** Detailed performance analysis (1.5M ops/sec).
* **[Architecture](https://www.google.com/search?q=docs/ARCHITECTURE.md):** Deep dive into the XOR+Trie hybrid model.
* **[Build System](https://www.google.com/search?q=docs/BUILD_SYSTEM.md):** How the data pipeline works.
* **[API Reference](https://www.google.com/search?q=docs/API_REFERENCE.md):** Full API documentation.

## 🛡️ Data Sources

Aggregates high-quality blocklists including:

* [OISD (Big & NSFW)](https://oisd.nl)
* [EasyPrivacy](https://easylist.to)
* [URLHaus](https://urlhaus.abuse.ch)
* [Phishing Army](https://phishing.army)
* ...and more.
