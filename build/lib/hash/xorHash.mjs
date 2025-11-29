import {murmurHash3} from "./lib/murmurHash3.mjs";

/**
 * Pre-calculates hashes for all items to speed up the retry loop.
 * Stores h1 and h2 for each item.
 * @param items
 * @return {{h1s: Uint32Array<ArrayBuffer>, h2s: Uint32Array<ArrayBuffer>}}
 */
export function precomputeHashes(items) {
    const size = items.length;
    const h1s = new Uint32Array(size);
    const h2s = new Uint32Array(size);

    for (let i = 0; i < size; i++) {
        h1s[i] = murmurHash3(items[i], 0x12345678);
        h2s[i] = murmurHash3(items[i], 0x87654321);
    }

    return { h1s, h2s };
}

/**
 * Calculates the three unique hash indices for a key using Double Hashing.
 * Index_i = (h1 + i * h2) % capacity
 * @param h1
 * @param h2
 * @param capacity
 * @return {number[]}
 */
export function getHashLocations(h1, h2, capacity) {
    // Ensure capacity is handled as a number (max domains ~1.2M < 2^32, so safe)
    const len = capacity;

    // Location 0: h1 % len
    let idx = h1 % len;
    if (idx < 0) idx += len;
    const h0 = idx;

    // Location 1: (h1 + h2) % len
    // Note: h1+h2 can overflow 32-bit, but % operator handles it correctly in JS double-precision
    idx = (h1 + h2) % len;
    if (idx < 0) idx += len;
    const l1 = idx;

    // Location 2: (h1 + 2*h2) % len
    idx = (h1 + (2 * h2)) % len;
    if (idx < 0) idx += len;
    const l2 = idx;

    return [h0, l1, l2];
}