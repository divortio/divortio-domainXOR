/**
 * @file build/lib/hash/xorHash.mjs
 * @description Provides utilities for pre-calculating hashes and deriving XOR filter indices.
 * Uses the cyrb53a_beta algorithm to generate two uncorrelated 32-bit hash states (h1, h2),
 * which are then used to map keys to three distinct slots in the filter.
 *
 * This module is critical for the build process and must mirror the logic in `src/lookup.mjs`.
 */

import { cyrb53 } from "./lib/cyrb53.mjs";

/**
 * Pre-calculates 32-bit hash pairs (h1, h2) for a list of items using the cyrb53 algorithm.
 * Returns TypedArrays for memory efficiency during the build process.
 *
 * @param {string[]} items - An array of strings (domains) to be hashed.
 * @returns {{h1s: Uint32Array, h2s: Uint32Array}} An object containing two parallel Uint32Arrays holding the h1 and h2 hash components for each item.
 */
export function precomputeHashes(items) {
    const size = items.length;
    const h1s = new Uint32Array(size);
    const h2s = new Uint32Array(size);

    for (let i = 0; i < size; i++) {
        // We ignore the seed argument as it's hardcoded in lookup.mjs (0xdeadbeef / 0x41c6ce57)
        const hash = cyrb53(items[i]);
        h1s[i] = hash.h1;
        h2s[i] = hash.h2;
    }

    return { h1s, h2s };
}

/**
 * Calculates the three unique slot indices for a key based on its two 32-bit hash components.
 * This function implements the mapping logic that allows the XOR filter to store information.
 *
 * Logic:
 * - Slot 0: h1 % capacity
 * - Slot 1: h2 % capacity
 * - Slot 2: (h1 + h2) % capacity
 *
 * @param {number} h1 - The first 32-bit hash component (unsigned integer).
 * @param {number} h2 - The second 32-bit hash component (unsigned integer).
 * @param {number} capacity - The total size of the filter (number of slots).
 * @returns {[number, number, number]} An array containing exactly three integer indices representing the slots for the key.
 */
export function getHashLocations(h1, h2, capacity) {
    const len = capacity;

    // Slot 0: Derived primarily from h1
    let idx = h1 % len;
    // Safety check for negative modulo results (though h1 is unsigned from cyrb53)
    if (idx < 0) idx += len;
    const h0 = idx;

    // Slot 1: Derived primarily from h2
    idx = h2 % len;
    if (idx < 0) idx += len;
    const l1 = idx;

    // Slot 2: Derived from mixing h1 and h2
    // Note: JS Numbers (doubles) can safely hold h1+h2 up to 2^53 without overflow.
    idx = (h1 + h2) % len;
    if (idx < 0) idx += len;
    const l2 = idx;

    return [h0, l1, l2];
}