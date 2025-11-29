# ❓ Frequently Asked Questions

### Why use an XOR Filter instead of a Bloom Filter?
XOR Filters are generally smaller (requiring ~1.23 bits per key vs ~10 bits for Bloom Filters for similar false positive rates) and faster for lookups because they don't require checking multiple bits. Most importantly, they support the "Peeling" construction which allows for perfect mapping without false negatives (though false positives are still possible).

### How do you handle wildcards like `*.co.uk`?
We use a **Public Suffix List (PSL) Trie**. Before checking any wildcard rule, the system scans the domain to find its "Effective Top-Level Domain" (eTLD), such as `co.uk`. We ensure that we never apply a wildcard block to an eTLD itself, preventing accidental blocking of entire country-code domains.

### What is the False Positive Rate?
Our current configuration uses **8-bit fingerprints**, which results in a theoretical False Positive Rate (FPR) of approximately **0.39%** ($1/256$). This tradeoff allows for extremely small file sizes (**~2.4 MB** for over 1.5 million rules).

### Why does the domain count differ from source lists?
Many source lists (like OISD) use wildcard rules to block millions of subdomains with a single line (e.g., `||example.com^`). Our build system counts this as **1 Rule**, but it effectively blocks thousands of subdomains. Additionally, we aggressively deduplicate domains across all source lists to keep the binary size efficient.

### Why is the binary size so small?
We use two layers of compression:
1.  **Logic Compression:** Wildcard rules (`*.example.com`) replace thousands of explicit subdomains.
2.  **Data Compression:** The XOR Filter structure uses only ~1.23 bits per entry + 8 bits for the fingerprint. This is significantly more efficient than raw text or hash maps.