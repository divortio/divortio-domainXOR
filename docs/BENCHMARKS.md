# ⚡ Performance Benchmarks

> **TL;DR:** Divortio DomainXOR processes **1.5 Million domains per second** with **sub-microsecond latency** on 2015-era consumer hardware.

## 🏆 The 1.5M Ops/Sec Milestone

Our primary design goal was **Zero-Allocation** runtime performance. To verify this, we benchmarked the engine against the **Tranco Top 1 Million** domain list, representing real-world traffic patterns (including ads, trackers, and safe sites).

### Hardware Baseline
All benchmarks were performed on legacy consumer hardware to establish a "worst-case" baseline. Deployment on modern serverless edge infrastructure (Cloudflare Workers, AWS Lambda) is expected to yield significantly higher throughput.

* **Machine:** MacBook Pro (Retina, 15-inch, Mid 2015)
* **Processor:** 2.5 GHz Quad-Core Intel Core i7 (Crystalwell / Haswell)
* **Memory:** 16 GB 1600 MHz DDR3L
* **Runtime:** Node.js v22+ (V8 Engine)

### Results

| Metric | Result | Unit |
| :--- | :--- | :--- |
| **Throughput** | **1,520,310** | Operations / Second |
| **Latency** | **0.00066** | Milliseconds / Request |
| **Blocked Rate** | **4.31%** | of Top 1M Domains |
| **Coverage** | **100%** | of 2.2M Source Rules |
| **Memory Delta** | **~0** | MB (Zero-Allocation Verified) |

> *Note: Memory delta fluctuating between -2MB and +2MB during a 1M loop confirms effective garbage collection and zero permanent heap allocation during the lookup phase.*

---

## 🔬 Methodology

### 1. Performance Benchmark (`test/benchmark.mjs`)
* **Dataset:** [Tranco Top 1 Million](https://tranco-list.eu/) (CSV).
* **Process:**
  1.  Full in-memory load of 1M unique domains.
  2.  V8 Warmup phase.
  3.  **Hot Loop:** Iterate through all 1M domains, performing full lookups.
  4.  Measurement of pure execution time (excluding I/O).
* **Goal:** Measure the pure CPU cost of the lookup function logic.

### 2. Coverage Verification (`build/build.03.validate.mjs`)
* **Dataset:** The actual source lists used for the build (OISD, EasyPrivacy, etc.).
* **Process:**
  1.  Re-ingest all 2.2 million raw rules.
  2.  Generate test cases for every **Exact** match.
  3.  Generate synthetic subdomains for every **Wildcard** rule (e.g., `test-123.ad.com`).
  4.  Verify `domainExists() == true` for all 2.2M cases.
* **Result:** **100% Pass Rate**. Every ingested rule is active.

### Why This Matters
* **Latency is Invisible:** At 0.0006ms, the lookup is **~50,000x faster** than a typical DNS query (~30ms). It adds effectively zero overhead to a network request.
* **Garbage Collection Free:** The stable memory footprint means no "Stop-the-World" GC pauses, ensuring consistent tail latency even under heavy load.
* **Reliability:** The 100% coverage test proves that the probabilistic filter (XOR) was built correctly without hash collisions dropping keys.