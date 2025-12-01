/**
 * @file src/lookup.mjs
 * @description The high-performance, zero-allocation runtime for checking domain block status.
 *
 * This module implements a "Hybrid Probabilistic Filter" designed for Cloudflare Workers:
 * 1. **16-bit XOR Filters**: O(1) probabilistic checks for Exact and Wildcard domains (~0.0015% FPR).
 * 2. **Shadow Whitelist**: A binary search-based rescue mechanism for known False Positives (Top 1M).
 * 3. **PSL Trie**: A binary Prefix Trie to correctly identify effective TLDs (e.g., `co.uk`).
 *
 * Optimizations:
 * - Inlined hashing (`cyrb53a`) to avoid function call overhead in V8.
 * - TypedArrays (`Uint16Array`, `Int32Array`) to avoid GC pressure.
 * - Single-pass parsing logic.
 *
 * @module DomainLookup
 */

/** @type {boolean} State flag to ensure buffers are only wrapped once. */
let isInitialized = false;

/** @type {Uint16Array} View of the Exact Match XOR filter (16-bit fingerprints). */
let exactFilter;

/** @type {Uint16Array} View of the Wildcard Parent XOR filter (16-bit fingerprints). */
let wildcardFilter;

/** @type {Uint32Array} View of the PSL Trie node structure (packed integers). */
let pslTrieNodes;

/** @type {Uint8Array} View of the PSL Trie string table (ASCII bytes). */
let pslStringTable;

/** @type {Uint32Array} Sorted array of hashes for whitelisted collision domains. */
let shadowWhitelist;

/**
 * Maximum number of labels (parts) allowed in a domain (e.g. `a.b.c.com` = 4).
 * Used to pre-allocate the `dotIndices` buffer. Matches `config.mjs`.
 * @constant {number}
 */
const MAX_DOMAIN_PARTS = 128;

/**
 * Global buffer to store dot positions during domain scanning.
 * CRITICAL: This makes the module non-reentrant (not thread-safe).
 * In Cloudflare Workers, this is safe because each request gets its own Isolate/Context.
 * In Node.js, this must NOT be shared across concurrent async requests.
 * @type {Int32Array}
 */
const dotIndices = new Int32Array(MAX_DOMAIN_PARTS);

/**
 * Initializes the global TypedArray views on the provided raw binary buffers.
 * Must be called before performing any lookups.
 *
 * @param {object} buffers - The container object for raw binary artifacts.
 * @param {ArrayBuffer} buffers.exactXOR - Binary data for the Exact Match XOR filter (Uint16).
 * @param {ArrayBuffer} buffers.wildcardXOR - Binary data for the Wildcard Match XOR filter (Uint16).
 * @param {ArrayBuffer} buffers.pslTrie - Binary data for the Public Suffix List Trie (Mixed).
 * @param {ArrayBuffer} [buffers.shadowWhitelist] - Optional binary data for the collision whitelist (Uint32).
 * @returns {void}
 */
function _init(buffers) {
    // 1. Initialize XOR Filters (16-bit views)
    // Matches XOR_BIT_DEPTH = 16 in config.mjs
    exactFilter = new Uint16Array(buffers.exactXOR);
    wildcardFilter = new Uint16Array(buffers.wildcardXOR);

    // 2. Initialize Shadow Whitelist (if present)
    // Used for "Rescue" logic (False Positive mitigation)
    if (buffers.shadowWhitelist && buffers.shadowWhitelist.byteLength > 0) {
        shadowWhitelist = new Uint32Array(buffers.shadowWhitelist);
    } else {
        // Fallback to a zero-length array to avoid null checks in the hot path
        shadowWhitelist = new Uint32Array(0);
    }

    // 3. Initialize PSL Trie
    // Layout: [Length(Uint32)][StringTable(Bytes)][NodeArray(Uint32)]
    const pslBuffer = buffers.pslTrie;
    const pslStringTableLength = new Uint32Array(pslBuffer, 0, 1)[0];
    const pslStringTableEnd = 4 + pslStringTableLength;

    pslStringTable = new Uint8Array(pslBuffer, 4, pslStringTableLength);
    pslTrieNodes = new Uint32Array(pslBuffer, pslStringTableEnd);

    isInitialized = true;
}

/**
 * Checks if a string segment matches the label stored in a Trie node.
 * Performs a byte-by-byte comparison against the `pslStringTable`.
 *
 * @param {number} nodeLabelPtr - The offset index into the string table.
 * @param {string} str - The domain string being checked.
 * @param {number} start - The starting index of the segment in `str`.
 * @param {number} end - The ending index of the segment in `str` (exclusive).
 * @returns {boolean} `true` if the segment matches the node label, otherwise `false`.
 */
function _nodeLabelMatches(nodeLabelPtr, str, start, end) {
    let i = 0;
    const length = end - start;
    while (true) {
        const tableByte = pslStringTable[nodeLabelPtr + i];

        // Null terminator in table means we reached end of label
        if (tableByte === 0) return i === length;

        // Mismatch or segment length exceeded
        if (i >= length || tableByte !== str.charCodeAt(start + i)) return false;

        i++;
    }
}

/**
 * Performs a binary search on a sorted Uint32Array to check for existence.
 * Used to check if a blocked domain hash is actually in the "Shadow Whitelist" (Rescue).
 *
 * @param {Uint32Array} arr - The sorted array of 32-bit hashes.
 * @param {number} val - The 32-bit hash value to find.
 * @returns {boolean} `true` if the value exists in the array, otherwise `false`.
 */
function binarySearch(arr, val) {
    let left = 0;
    let right = arr.length - 1;

    while (left <= right) {
        const mid = (left + right) >>> 1;
        const midVal = arr[mid];

        if (midVal < val) {
            left = mid + 1;
        } else if (midVal > val) {
            right = mid - 1;
        } else {
            return true;
        }
    }
    return false;
}

/**
 * Checks if a substring exists within a specific XOR filter using 16-bit fingerprints.
 * Includes "Rescue" logic: if a block is found, it consults the Shadow Whitelist.
 *
 * Uses an inlined version of `cyrb53a` for maximum performance (no function call overhead).
 *
 * @param {string} str - The source domain string.
 * @param {number} start - The start index of the substring.
 * @param {number} end - The end index of the substring.
 * @param {Uint16Array} filter - The XOR filter view to check against.
 * @returns {boolean} `true` if the domain is blocked (and NOT whitelisted), otherwise `false`.
 */
function _xorContains(str, start, end, filter) {
    const len = filter.length;
    if (len === 0) return false;

    // --- cyrb53a_beta (Inlined Hash) ---
    // Seed = 0 (0xdeadbeef / 0x41c6ce57)
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;

    for (let i = start; i < end; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 0x85ebca77);
        h2 = Math.imul(h2 ^ ch, 0xc2b2ae3d);
    }

    // Avalanche mixing
    h1 ^= Math.imul(h1 ^ (h2 >>> 15), 0x735a2d97);
    h2 ^= Math.imul(h2 ^ (h1 >>> 15), 0xcaf649a9);
    h1 ^= h2 >>> 16;
    h2 ^= h1 >>> 16;

    // Ensure unsigned 32-bit integers for slot calculation
    const h1u = h1 >>> 0;
    const h2u = h2 >>> 0;
    // ----------------------------

    // Map to 3 slots
    const h0 = h1u % len;
    const l1 = h2u % len;
    const l2 = (h1u + h2u) % len;

    // UPDATED: Extract 16-bit fingerprint (0xFFFF)
    // Must match BUILD config (XOR_BIT_DEPTH = 16)
    let fp = (h1u >>> 16) & 0xFFFF;

    // Fix "Zero Bias": Ensure fingerprint is never 0
    if (fp === 0) fp = (h2u >>> 16) & 0xFFFF;
    if (fp === 0) fp = 1;

    // Direct XOR check
    const matchesFilter = fp === (filter[h0] ^ filter[l1] ^ filter[l2]);

    if (!matchesFilter) return false;

    // --- WHITELIST RESCUE ---
    // If the filter says "Block", check the Shadow Whitelist.
    // If found, this is a known False Positive -> Rescue it (Return False).
    if (shadowWhitelist.length > 0) {
        // Reuse h1u (the 32-bit hash) for the check to avoid re-hashing
        if (binarySearch(shadowWhitelist, h1u)) {
            return false; // Rescued
        }
    }

    return true; // Confirmed Block
}

/**
 * Determines if a domain is blocked by checking the Exact and Wildcard filters.
 *
 * This function performs a sequential scan:
 * 1. **Exact Check**: Is the full domain blocked?
 * 2. **Dot Scan**: Locates all dot positions without string splitting.
 * 3. **PSL Discovery**: Traverses the Trie to find the "Effective TLD" (e.g., `co.uk`).
 * 4. **Wildcard Check**: Checks all parent domains up to the effective TLD.
 *
 * @param {string} domain - The fully qualified domain name to check (must be lowercase).
 * @param {object} buffers - The buffer object containing `exactXOR`, `wildcardXOR`, `pslTrie`, and optional `shadowWhitelist`.
 * @returns {boolean} `true` if the domain or any of its valid parents are blocked.
 */
export function domainExists(domain, buffers) {
    if (!isInitialized) _init(buffers);

    // Sanity Check: Input must be a valid string within DNS limits (253 chars)
    if (!domain || typeof domain !== 'string' || domain.length > 253) return false;

    const len = domain.length;

    // 1. Exact Match Check
    if (_xorContains(domain, 0, len, exactFilter)) return true;

    // 2. Dot Scanning (Zero-Alloc)
    // Locate all dot positions to allow substring operations without splitting
    let dotCount = 0;
    for (let i = 0; i < len; i++) {
        if (domain.charCodeAt(i) === 46) { // 46 == '.'
            if (dotCount < MAX_DOMAIN_PARTS) dotIndices[dotCount++] = i;
        }
    }

    // 3. Trie Traversal (PSL Discovery)
    let nodePtr = 0;
    let currentEnd = len;
    let lastPslIndex = -1;

    // Iterate backwards through parts to walk the Trie (com -> google -> etc)
    for (let i = dotCount - 1; i >= -1; i--) {
        const start = (i === -1) ? 0 : dotIndices[i] + 1;
        let foundChild = false;

        if (nodePtr === 0 && i === dotCount - 1) {
            // Implicit start at root
        } else {
            // Advance to first child pointer
            nodePtr = pslTrieNodes[nodePtr + 1];
        }

        // Walk siblings to find match
        while (nodePtr !== 0) {
            const labelRef = pslTrieNodes[nodePtr];
            if (_nodeLabelMatches(labelRef, domain, start, currentEnd)) {
                foundChild = true;
                break;
            }
            // Move to next sibling
            nodePtr = pslTrieNodes[nodePtr + 2];
        }

        if (foundChild) {
            // Check flags (Bit 1 = isTerminal/Public Suffix)
            const flags = pslTrieNodes[nodePtr + 3];
            if ((flags & 1) === 1) {
                lastPslIndex = (i === -1) ? 0 : dotIndices[i];
            }
            currentEnd = start - 1;
        } else {
            // No more matches in Trie, stop PSL search
            break;
        }
    }

    // 4. Wildcard Checks
    // Check every parent domain up to (but not including) the Public Suffix.
    // e.g. for `a.b.google.co.uk`, check `a.b.google.co.uk`, `b.google.co.uk`, `google.co.uk`
    // Stop before checking `co.uk`.
    for (let i = -1; i < dotCount; i++) {
        const start = (i === -1) ? 0 : dotIndices[i] + 1;

        // Stop if we hit the effective TLD
        if (lastPslIndex !== -1 && start > lastPslIndex) break;

        if (_xorContains(domain, start, len, wildcardFilter)) return true;
    }

    return false;
}