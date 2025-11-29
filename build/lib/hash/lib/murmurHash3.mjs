
/**
 * MurmurHash3 32-bit implementation.
 * Optimized for V8 SMI (Small Integer) performance.
 * Matches the logic in src/xor/lookup.mjs exactly.
 *
 * @param {string} key - The source string.
 * @param {number} seed - A 32-bit integer seed.
 * @returns {number} A 32-bit integer hash.
 */
export function murmurHash3(key, seed) {
    let h1 = seed | 0;
    let k1 = 0;
    let i = 0;

    // Process 4-byte chunks (simulated by reading char codes)
    // Note: Domain characters are generally 1 byte (ASCII/Punycode).
    // We process 4 chars at a time to mimic 32-bit reads.
    const len = key.length;
    const remainder = len & 3; // len % 4
    const bytes = len - remainder;

    for (; i < bytes; i += 4) {
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
