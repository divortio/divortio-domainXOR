/**
 * @file src/xor/lookup.mjs
 * @description Zero-Allocation lookup logic using optimized MurmurHash3 (32-bit).
 * Replaces BigInt 64-bit hashing with faster 32-bit double-hashing for V8 SMI optimization.
 */

let isInitialized = false;
let exactFilter;
let wildcardFilter;
let pslTrieNodes;
let pslStringTable;

const MAX_DOMAIN_PARTS = 128;
const dotIndices = new Int32Array(MAX_DOMAIN_PARTS);

/**
 * MurmurHash3 32-bit implementation, optimized for V8.
 * Hashes a substring without allocation.
 * * @param {string} key - The source string.
 * @param {number} start - The starting index (inclusive).
 * @param {number} end - The ending index (exclusive).
 * @param {number} seed - A 32-bit integer seed.
 * @returns {number} A 32-bit integer hash.
 */
function murmurHash3(key, start, end, seed) {
    let h1 = seed | 0;
    let k1 = 0;
    let i = start;

    // Process 4-byte chunks (simulated by reading char codes)
    // Note: Domain characters are generally 1 byte (ASCII/Punycode).
    // We process 4 chars at a time to mimic 32-bit reads.
    const len = end - start;
    const remainder = len & 3; // len % 4
    const bytes = len - remainder;

    for (; i < start + bytes; i += 4) {
        const c0 = key.charCodeAt(i);
        const c1 = key.charCodeAt(i + 1);
        const c2 = key.charCodeAt(i + 2);
        const c3 = key.charCodeAt(i + 3);

        // Combine 4 chars into a 32-bit block (Little Endian-ish)
        k1 = (c0 & 0xff) | ((c1 & 0xff) << 8) | ((c2 & 0xff) << 16) | ((c3 & 0xff) << 24);

        k1 = Math.imul(k1, 0xcc9e2d51);
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = Math.imul(k1, 0x1b873593);

        h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19);
        h1 = Math.imul(h1, 5) + 0xe6546b64;
    }

    // Process remaining bytes
    k1 = 0;
    switch (remainder) {
        case 3: k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
        case 2: k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
        case 1: k1 ^= (key.charCodeAt(i) & 0xff);
            k1 = Math.imul(k1, 0xcc9e2d51);
            k1 = (k1 << 15) | (k1 >>> 17);
            k1 = Math.imul(k1, 0x1b873593);
            h1 ^= k1;
    }

    // Finalization
    h1 ^= len;
    h1 ^= h1 >>> 16;
    h1 = Math.imul(h1, 0x85ebca6b);
    h1 ^= h1 >>> 13;
    h1 = Math.imul(h1, 0xc2b2ae35);
    h1 ^= h1 >>> 16;

    return h1 >>> 0; // Ensure positive integer
}

function _init(buffers) {
    exactFilter = new Uint8Array(buffers.exactXOR);
    wildcardFilter = new Uint8Array(buffers.wildcardXOR);
    const pslBuffer = buffers.pslTrie;
    const pslStringTableLength = new Uint32Array(pslBuffer, 0, 1)[0];
    const pslStringTableEnd = 4 + pslStringTableLength;
    pslStringTable = new Uint8Array(pslBuffer, 4, pslStringTableLength);
    pslTrieNodes = new Uint32Array(pslBuffer, pslStringTableEnd);
    isInitialized = true;
}

function _nodeLabelMatches(nodeLabelPtr, str, start, end) {
    let i = 0;
    const length = end - start;
    while (true) {
        const tableByte = pslStringTable[nodeLabelPtr + i];
        if (tableByte === 0) return i === length;
        // Note: Trusting URL.hostname provides lowercase, but Trie is raw bytes.
        // Punycode is ASCII, so direct comparison is safe.
        if (i >= length || tableByte !== str.charCodeAt(start + i)) return false;
        i++;
    }
}

/**
 * Optimized XOR lookup using Double Hashing (Murmur3).
 * Generates 3 indices and 1 fingerprint from two 32-bit hashes.
 */
function _xorContains(str, start, end, filter) {
    const len = filter.length;
    if (len === 0) return false;

    // Compute two 32-bit hashes with different seeds
    const h1 = murmurHash3(str, start, end, 0x12345678); // Seed A
    const h2 = murmurHash3(str, start, end, 0x87654321); // Seed B

    // Double Hashing Technique: h_i = h1 + (i * h2)
    // Use standard modulo for wrapping. Math.abs ensures positive indices.

    // Location 0
    let idx = h1 % len;
    if (idx < 0) idx += len;
    const h0 = idx;

    // Location 1
    idx = (h1 + h2) % len;
    if (idx < 0) idx += len;
    const l1 = idx;

    // Location 2
    idx = (h1 + (2 * h2)) % len;
    if (idx < 0) idx += len;
    const l2 = idx;

    // Fingerprint: Derive from h2 (8-bit)
    let fp = (h2 >>> 24) & 0xFF;
    if (fp === 0) fp = 1;

    // Direct XOR check
    return fp === (filter[h0] ^ filter[l1] ^ filter[l2]);
}

export function domainExists(domain, buffers) {
    if (!isInitialized) _init(buffers);

    // Optimization: Removed toLowerCase() and trim()
    // We assume the caller (URL API) guarantees a clean, lowercase, punycode string.
    // This saves a string allocation per request.
    if (!domain || typeof domain !== 'string' || domain.length > 253) return false;

    const len = domain.length;

    // 1. Exact Match
    if (_xorContains(domain, 0, len, exactFilter)) return true;

    // 2. Dot Scanning (Zero-Alloc)
    let dotCount = 0;
    for (let i = 0; i < len; i++) {
        if (domain.charCodeAt(i) === 46) {
            if (dotCount < MAX_DOMAIN_PARTS) dotIndices[dotCount++] = i;
        }
    }

    // 3. Trie Traversal
    let nodePtr = 0;
    let currentEnd = len;
    let lastPslIndex = -1;

    for (let i = dotCount - 1; i >= -1; i--) {
        const start = (i === -1) ? 0 : dotIndices[i] + 1;
        let foundChild = false;

        if (nodePtr === 0 && i === dotCount - 1) {
            // implicit start
        } else {
            nodePtr = pslTrieNodes[nodePtr + 1];
        }

        while (nodePtr !== 0) {
            const labelRef = pslTrieNodes[nodePtr];
            if (_nodeLabelMatches(labelRef, domain, start, currentEnd)) {
                foundChild = true;
                break;
            }
            nodePtr = pslTrieNodes[nodePtr + 2];
        }

        if (foundChild) {
            const flags = pslTrieNodes[nodePtr + 3];
            if ((flags & 1) === 1) lastPslIndex = (i === -1) ? 0 : dotIndices[i];
            currentEnd = start - 1;
        } else {
            break;
        }
    }

    // 4. Wildcard Checks
    for (let i = -1; i < dotCount; i++) {
        const start = (i === -1) ? 0 : dotIndices[i] + 1;
        if (lastPslIndex !== -1 && start > lastPslIndex) break;
        if (_xorContains(domain, start, len, wildcardFilter)) return true;
    }

    return false;
}