/**
 * @file /build/xorFilterBuilder.mjs
 * @description A self-contained, generic module for building a binary XOR filter.
 * @module XORFilterBuilder
 */

/**
 * A 64-bit hashing function (splitmix64).
 * @param {number} n - A 64-bit integer represented as two 32-bit integers.
 * @returns {number} The next hash in the sequence.
 */
function splitmix64(n) {
    n += 0x9e3779b97f4a7c15;
    n = (n ^ (n >> 30)) * 0xbf58476d1ce4e5b9;
    n = (n ^ (n >> 27)) * 0x94d049bb133111eb;
    return n ^ (n >> 31);
}

/**
 * Hashes a string into a 64-bit integer.
 * @param {string} str - The string to hash.
 * @returns {number} A 64-bit hash.
 */
function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
    }
    return splitmix64(h);
}

/**
 * Creates the three hash locations for an item in the filter.
 * @param {number} keyHash - The 64-bit hash of the key.
 * @param {number} capacity - The capacity of the fingerprint array.
 * @returns {number[]} An array of three indices.
 */
function getHashLocations(keyHash, capacity) {
    const h0 = keyHash % capacity;
    const h1 = (keyHash >> 16) % capacity;
    const h2 = (keyHash >> 32) % capacity;
    return [h0, h1, h2];
}

/**
 * The main exported function. It takes a list of strings and returns a
 * fully serialized binary XOR filter.
 *
 * @param {string[]} items - An array of unique strings to build the filter from.
 * @returns {Buffer} The final binary XOR filter as a Node.js Buffer.
 */
export function buildXORFilter(items) {
    const size = items.length;
    const capacity = Math.ceil(size * 1.23); // Standard overhead for XOR filters
    const fingerprints = new BigUint64Array(capacity).fill(0n);
    const hashes = new BigUint64Array(size);
    for (let i = 0; i < size; i++) {
        hashes[i] = BigInt(hash(items[i]));
    }

    const q = new Array(capacity).fill(0).map(() => []);
    const stack = [];
    for (let i = 0; i < size; i++) {
        const h = hashes[i];
        const [h0, h1, h2] = getHashLocations(Number(h), capacity);
        q[h0].push(i);
        q[h1].push(i);
        q[h2].push(i);
    }

    for (let i = 0; i < capacity; i++) {
        if (q[i].length === 1) {
            stack.push(q[i][0]);
        }
    }

    let stackPtr = 0;
    while (stackPtr < stack.length) {
        const i = stack[stackPtr++];
        const h = hashes[i];
        const [h0, h1, h2] = getHashLocations(Number(h), capacity);

        q[h0] = q[h0].filter(j => j !== i);
        if (q[h0].length === 1) stack.push(q[h0][0]);
        q[h1] = q[h1].filter(j => j !== i);
        if (q[h1].length === 1) stack.push(q[h1][0]);
        q[h2] = q[h2].filter(j => j !== i);
        if (q[h2].length === 1) stack.push(q[h2][0]);
    }

    if (stack.length !== size) {
        throw new Error("Build failed: Could not create XOR filter. This can happen with duplicate keys or hash collisions.");
    }

    for (let i = stack.length - 1; i >= 0; i--) {
        const idx = stack[i];
        const h = hashes[idx];
        const [h0, h1, h2] = getHashLocations(Number(h), capacity);
        const fingerprint = h ^ fingerprints[h1] ^ fingerprints[h2];
        fingerprints[h0] = fingerprint;
    }

    // Return as a standard Node.js Buffer from the BigUint64Array's underlying buffer.
    return Buffer.from(fingerprints.buffer);
}