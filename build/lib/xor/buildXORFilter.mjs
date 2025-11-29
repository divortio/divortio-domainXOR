/**
 * @file build/xor/buildXORFilter.mjs
 * @description A self-contained, generic module for building a binary XOR filter.
 *
 * This module implements a "Perfect Hash" based Bloom filter alternative using 8-bit fingerprints.
 * It constructs a graph of keys and maps them to a fixed-size array such that the XOR of
 * values at three computed locations equals the key's fingerprint.
 *
 * CRITICAL: The hashing logic (MurmurHash3 32-bit Double Hashing) and index derivation algorithms
 * in this file must EXACTLY match the logic in `src/xor/lookup.mjs`. Any deviation will result in
 * 100% false negatives (lookup failures).
 *
 * @module XORFilterBuilder
 */

import {precomputeHashes, getHashLocations} from '../hash/xorHash.mjs'

// --- Configuration ---
// Using 8 bits (Uint8) keeps the file size very small (~1.23 bytes per key).
// This results in a theoretical False Positive Rate of approx 0.39% (1/256).
export const FINGERPRINT_BITS = 8;


/**
 * Extracts an 8-bit fingerprint from the h2 hash.
 * Must match the logic in lookup.mjs: (h2 >>> 24) & 0xFF
 */
function getFingerprint(h2) {
    let fp = (h2 >>> 24) & 0xFF;
    // We avoid 0 to distinguish it from empty slots.
    return fp === 0 ? 1 : fp;
}

/**
 * Attempts to build the XOR filter graph with a specific capacity.
 * @param items
 * @param capacity
 * @param h1s
 * @param h2s
 * @return {Uint8Array<ArrayBuffer> | null}
 */
function tryBuildXORFilter(items, capacity, h1s, h2s) {
    const size = items.length;
    const fingerprints = new Uint8Array(capacity).fill(0);

    // The graph: q[i] contains the list of key indices mapped to location i.
    const q = new Array(capacity).fill(0).map(() => []);

    // Stack stores { key: i, loc: pureLoc }
    const stack = [];

    // Track which keys are processed to prevent double-adding
    const keyInStack = new Uint8Array(size).fill(0);

    // Step 1: Build the graph
    for (let i = 0; i < size; i++) {
        const h1 = h1s[i];
        const h2 = h2s[i];
        const [h0, l1, l2] = getHashLocations(h1, h2, capacity);
        q[h0].push(i);
        q[l1].push(i);
        q[l2].push(i);
    }

    // Step 2: Find initial "pure" nodes (locations with exactly one key)
    for (let i = 0; i < capacity; i++) {
        if (q[i].length === 1) {
            const key = q[i][0];
            if (keyInStack[key] === 0) {
                keyInStack[key] = 1;
                stack.push({ key: key, loc: i });
            }
        }
    }

    // Step 3: Peel the graph
    let stackPtr = 0;
    while (stackPtr < stack.length) {
        const { key: i, loc: pureLoc } = stack[stackPtr++];
        const h1 = h1s[i];
        const h2 = h2s[i];
        const [h0, l1, l2] = getHashLocations(h1, h2, capacity);

        // Remove 'i' from the OTHER two locations
        const locations = [h0, l1, l2];

        for (const loc of locations) {
            if (loc === pureLoc) continue;

            if (q[loc].length > 0) {
                const idx = q[loc].indexOf(i);
                if (idx !== -1) {
                    q[loc].splice(idx, 1);
                }
            }

            // If this location became pure, add its neighbor to stack
            if (q[loc].length === 1) {
                const neighborKey = q[loc][0];
                if (keyInStack[neighborKey] === 0) {
                    keyInStack[neighborKey] = 1;
                    stack.push({ key: neighborKey, loc: loc });
                }
            }
        }
    }

    if (stack.length !== size) {
        return null; // Failed mapping (cycle detected)
    }

    // Step 4: Assign fingerprints by processing the stack in reverse
    for (let i = stack.length - 1; i >= 0; i--) {
        const { key: idx, loc: pureLoc } = stack[i];
        const h1 = h1s[idx];
        const h2 = h2s[idx];

        const fp = getFingerprint(h2);
        const [h0, l1, l2] = getHashLocations(h1, h2, capacity);

        // Solve XOR: fingerprints[pureLoc] = fp ^ (XOR sum of other two locations)
        let otherXor = 0;
        if (h0 !== pureLoc) otherXor ^= fingerprints[h0];
        if (l1 !== pureLoc) otherXor ^= fingerprints[l1];
        if (l2 !== pureLoc) otherXor ^= fingerprints[l2];

        fingerprints[pureLoc] = fp ^ otherXor;
    }

    return fingerprints;
}

/**
 * The main exported function to build a serialized XOR filter.
 *
 * @param {string[]} items - An array of unique strings to build the filter from.
 * @returns {Buffer<ImplicitArrayBuffer<ArrayBuffer>>} The final binary XOR filter as a Node.js Buffer.
 * @throws {Error} If the items list is empty or if construction fails after maximum retries.
 */
export function buildXORFilter(items) {
    if (!items || items.length === 0) {
        throw new Error("Cannot build an XOR filter with zero items.");
    }

    const size = items.length;

    // Pre-calculate hashes once using MurmurHash3.
    const { h1s, h2s } = precomputeHashes(items);

    // Initial capacity: 1.23x is the theoretical efficiency sweet spot.
    // Enforce a minimum capacity (32) to avoid small-set collisions.
    let capacity = Math.max(Math.ceil(size * 1.23), 32);

    const MAX_RETRIES = 100;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const filter = tryBuildXORFilter(items, capacity, h1s, h2s);

        if (filter) {
            if (attempt > 0) {
                console.log(`    └─ Info: Construction succeeded after ${attempt} retry(s). Final capacity: ${capacity}.`);
            }
            return Buffer.from(filter.buffer);
        }

        // Failure: The graph contained a cycle.
        // Increase capacity more aggressively (5% + constant) to quickly find a solution.
        capacity += Math.ceil(size * 0.05) + 13;
    }

    throw new Error(`Build failed: Could not create perfect XOR mapping after ${MAX_RETRIES} resizing attempts.`);
}