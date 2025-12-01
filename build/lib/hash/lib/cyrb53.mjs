/**
 * @file build/lib/hash/lib/cyrb53.mjs
 * @description The cyrb53a_beta hash implementation.
 * Must match the inlined logic in src/lookup.mjs exactly.
 */

/**
 * Computes the 53-bit hash (split into two 32-bit integers) for a string.
 * @param {string} str
 * @param {number} seed - (Unused in beta A, but kept for signature compat)
 * @returns {{h1: number, h2: number}}
 */
export function cyrb53(str, seed = 0) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;

    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 0x85ebca77);
        h2 = Math.imul(h2 ^ ch, 0xc2b2ae3d);
    }

    h1 ^= Math.imul(h1 ^ (h2 >>> 15), 0x735a2d97);
    h2 ^= Math.imul(h2 ^ (h1 >>> 15), 0xcaf649a9);
    h1 ^= h2 >>> 16;
    h2 ^= h1 >>> 16;

    return {
        h1: h1 >>> 0,
        h2: h2 >>> 0
    };
}