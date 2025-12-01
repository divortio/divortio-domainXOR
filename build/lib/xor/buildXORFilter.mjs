/**
 * @file build/lib/xor/buildXORFilter.mjs
 * @description A generic, self-contained module for building a binary XOR filter from a list of strings.
 * It implements a "Perfect Hash" based probabilistic filter using 16-bit fingerprints.
 * The builder constructs a hypergraph where nodes are mapped to three computed locations,
 * and edge values (fingerprints) are solved using a peeling algorithm to satisfy the XOR property.
 *
 * CRITICAL: The hashing logic (cyrb53a) and index derivation algorithms in this file must
 * EXACTLY match the logic in `src/lookup.mjs`. Any deviation will result in 100% false negatives.
 *
 * @module XORFilterBuilder
 */

import { precomputeHashes, getHashLocations } from '../hash/xorHash.mjs';
import { XOR_BIT_DEPTH } from '../../config.mjs';

/**
 * The bit-width of the stored fingerprint.
 * Imported from central config. Currently set to 16 bits (Uint16) to drastically
 * reduce the False Positive Rate to ~0.0015%.
 * @constant {number}
 */
export const FINGERPRINT_BITS = XOR_BIT_DEPTH;

/**
 * Extracts a fingerprint of the configured bit-depth from the two 32-bit hash components.
 * Matches the logic in `src/lookup.mjs` exactly.
 *
 * Logic for 16-bit:
 * 1. Use high 16 bits of h1.
 * 2. If 0, use high 16 bits of h2 (Bias Fix).
 * 3. If still 0, fallback to 1 (Zero Avoidance).
 *
 * @param {number} h1 - The first 32-bit hash component (unsigned).
 * @param {number} h2 - The second 32-bit hash component (unsigned).
 * @returns {number} A 16-bit integer (1-65535) representing the fingerprint.
 */
function getFingerprint(h1, h2) {
    // Extract 16 bits (0xFFFF)
    // Note: If XOR_BIT_DEPTH changes, this bitwise logic must be updated manually
    // alongside the TypedArray used in tryBuildXORFilter.
    let fp = (h1 >>> 16) & 0xFFFF;

    // Fix "Zero Bias" logic from lookup.mjs
    // We cannot allow a fingerprint of 0 because 0 implies "Empty Slot" in some contexts,
    // and ensuring non-zero simplifies the lookup XOR math (0 ^ 0 = 0).
    if (fp === 0) fp = (h2 >>> 16) & 0xFFFF;
    if (fp === 0) fp = 1;

    return fp;
}

/**
 * Attempts to build the XOR filter graph with a specific capacity.
 * Implements the "Peeling" algorithm to solve the linear system.
 *
 * @param {string[]} items - The original array of items (used for verification/graph logic).
 * @param {number} capacity - The number of slots in the filter (m).
 * @param {Uint32Array} h1s - Precomputed h1 hashes for all items.
 * @param {Uint32Array} h2s - Precomputed h2 hashes for all items.
 * @returns {Uint16Array|null} The constructed filter array if successful, or null if a cycle was detected (Peeling failed).
 */
function tryBuildXORFilter(items, capacity, h1s, h2s) {
    const size = items.length;

    // STORAGE: Use Uint16Array for 16-bit storage (matches XOR_BIT_DEPTH=16)
    // CRITICAL: If XOR_BIT_DEPTH changes to 8, this must change to Uint8Array.
    const fingerprints = new Uint16Array(capacity).fill(0);

    // The graph: q[i] contains the list of key indices mapped to location i.
    /** @type {Array<Array<number>>} */
    const q = new Array(capacity).fill(0).map(() => []);

    // Stack stores { keyIndex, pureLocation } for the peeling order
    /** @type {Array<{key: number, loc: number}>} */
    const stack = [];

    // Track which keys are added to the stack to prevent double-processing
    const keyInStack = new Uint8Array(size).fill(0);

    // Step 1: Build the hypergraph
    // Map every key to its 3 locations using the precomputed hashes
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
    // Repeatedly remove pure nodes and check if their removal creates new pure nodes.
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

    // If we couldn't peel all keys, the graph has a cycle (2-core).
    // The mapping is impossible with this hash seed/capacity configuration.
    if (stack.length !== size) {
        return null;
    }

    // Step 4: Assign fingerprints by processing the stack in reverse (reverse-peeling)
    // Equation: fingerprints[pureLoc] = targetFP ^ XOR(other_locations)
    for (let i = stack.length - 1; i >= 0; i--) {
        const { key: idx, loc: pureLoc } = stack[i];
        const h1 = h1s[idx];
        const h2 = h2s[idx];

        const fp = getFingerprint(h1, h2);
        const [h0, l1, l2] = getHashLocations(h1, h2, capacity);

        let otherXor = 0;
        if (h0 !== pureLoc) otherXor ^= fingerprints[h0];
        if (l1 !== pureLoc) otherXor ^= fingerprints[l1];
        if (l2 !== pureLoc) otherXor ^= fingerprints[l2];

        fingerprints[pureLoc] = fp ^ otherXor;
    }

    return fingerprints;
}

/**
 * The main exported function to build a serialized XOR filter from a list of items.
 * It manages the retry loop, incrementally increasing capacity until a valid mapping is found.
 *
 * @param {string[]} items - An array of unique strings to build the filter from.
 * @returns {Buffer} The final binary XOR filter as a Node.js Buffer (Uint16Array backed).
 * @throws {Error} If the items list is empty or if construction fails after maximum retries.
 */
export function buildXORFilter(items) {
    if (!items || items.length === 0) {
        throw new Error("Cannot build an XOR filter with zero items.");
    }

    const size = items.length;

    // Pre-calculate hashes once using cyrb53.
    // This avoids re-hashing millions of strings during the retry loop.
    const { h1s, h2s } = precomputeHashes(items);

    // Initial capacity: 1.23x is the theoretical efficiency sweet spot for 3-XOR filters.
    // Enforce a minimum capacity (32) to avoid collisions in very small sets.
    let capacity = Math.max(Math.ceil(size * 1.23), 32);

    const MAX_RETRIES = 100;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const filter = tryBuildXORFilter(items, capacity, h1s, h2s);

        if (filter) {
            if (attempt > 0) {
                console.log(`    └─ Info: Construction succeeded after ${attempt} retry(s). Final capacity: ${capacity}.`);
            }
            // Return as a Node.js Buffer (copying the underlying ArrayBuffer)
            // Note: Buffer.from(typedArray.buffer) shares memory, which is efficient.
            return Buffer.from(filter.buffer);
        }

        // Failure: The graph contained a cycle.
        // Increase capacity more aggressively (5% + constant) to quickly find a solution.
        capacity += Math.ceil(size * 0.05) + 13;
    }

    throw new Error(`Build failed: Could not create perfect XOR mapping after ${MAX_RETRIES} resizing attempts.`);
}