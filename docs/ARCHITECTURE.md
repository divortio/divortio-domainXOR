# 🏗️ System Architecture

Divortio DomainXOR is a **Hybrid Probabilistic Filter** designed for high-performance domain blocking. It combines the space efficiency of XOR Filters with the structural awareness of a Prefix Trie.

## Core Components

### 1. The Hybrid Model
We do not use a single data structure. Instead, we split the problem into three optimized layers:

| Component | Type | Purpose |
| :--- | :--- | :--- |
| **Exact Filter** | **XOR Filter (8-bit)** | Instant check for specific domains (e.g., `doubleclick.net`). $O(1)$ lookup. |
| **Wildcard Filter** | **XOR Filter (8-bit)** | Checks parent domains (e.g., `googleadservices.com`) to block all subdomains. |
| **PSL Trie** | **Binary Trie** | Identifies the "Effective TLD" (e.g., `co.uk` vs `com`) to prevent wildcarding entire TLDs. |

### 2. Zero-Allocation Runtime
The entire runtime (`src/lib/lookup.mjs`) is written to avoid **Heap Allocations**.
* **No Strings:** We never create new strings using `.substring()` or `.split()` during lookup.
* **No Arrays:** We use a pre-allocated `Int32Array` to store dot positions during domain scanning.
* **Views:** We perform lookups using `Uint8Array` views on the raw ArrayBuffer.

### 3. MurmurHash3 (32-bit Double Hashing)
We use a custom implementation of **MurmurHash3** optimized for V8's SMI (Small Integer) path.
* **Why not 64-bit?** BigInt in JavaScript allocates memory and is slow.
* **The Trick:** We compute two 32-bit hashes ($h_1, h_2$) and combine them mathematically ($h_1 + i \times h_2$) to simulate an infinite number of hash functions, achieving 64-bit collision resistance with 32-bit speed.

---

## Data Pipeline (The Funnel)



[Image of data funnel visualization]


1.  **Ingest:** Fetch raw text lists (Hosts, Adblock, ABP) from sources like OISD and EasyPrivacy.
2.  **Parse & Normalize:** Convert all input to Punycode (ASCII), strip comments, and identify wildcards.
3.  **Deduplicate:** Merge all sources into a single unique Set.
4.  **Build:**
    * **Exact XOR:** Solve the linear system to map exact domains.
    * **Wildcard XOR:** Solve the linear system to map wildcard bases.
    * **PSL Trie:** Compile the Public Suffix List into a compact binary tree.
5.  **Verify:** Run a coverage test against every ingested domain to ensure 100% accuracy.
6.  **Output:** Generate `.bin` artifacts and a `meta.mjs` summary.