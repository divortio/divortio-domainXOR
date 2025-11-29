/**
 * @file test/unit.test.mjs
 * @description Unit tests verifying mathematical consistency between Builder and Runtime logic.
 * Uses Node.js native test runner.
 */

import { test } from 'node:test';
import assert from 'node:assert';

// ==========================================
// 1. REPLICA: Builder Logic
// Copied exactly from build/buildXORFilter.mjs
// ==========================================

const BUILDER_FINGERPRINT_BITS = 8;

function builder_hashString64(str) {
    let h = 0xcbf29ce484222325n; // FNV offset basis
    const prime = 0x100000001b3n; // FNV prime

    for (let i = 0; i < str.length; i++) {
        h ^= BigInt(str.charCodeAt(i));
        h *= prime;
        h &= 0xffffffffffffffffn;
    }
    return h;
}

function builder_getHashLocations(keyHash, capacity) {
    const cap = BigInt(capacity);
    const h0 = Number(keyHash % cap);
    const h1 = Number((keyHash >> 16n) % cap);
    const h2 = Number((keyHash >> 32n) % cap);
    return [h0, h1, h2];
}

function builder_getFingerprint(keyHash) {
    let fp = Number((keyHash >> 56n) & 0xFFn);
    return fp === 0 ? 1 : fp;
}

// ==========================================
// 2. REPLICA: Runtime Logic (Zero-Allocation)
// Copied exactly from src/xor/lookup.mjs
// ==========================================

function runtime_hashSubstring64(str, start, end) {
    let h = 0xcbf29ce484222325n; // FNV offset basis
    const prime = 0x100000001b3n; // FNV prime
    for (let i = start; i < end; i++) {
        h ^= BigInt(str.charCodeAt(i));
        h *= prime;
        h &= 0xffffffffffffffffn; // Enforce 64-bit wrapping
    }
    return h;
}

function runtime_getHashLocations(keyHash, capacity) {
    const cap = BigInt(capacity);
    const h0 = Number(keyHash % cap);
    const h1 = Number((keyHash >> 16n) % cap);
    const h2 = Number((keyHash >> 32n) % cap);
    return [h0, h1, h2];
}

function runtime_getFingerprint(keyHash) {
    let fp = Number((keyHash >> 56n) & 0xFFn);
    return fp === 0 ? 1 : fp;
}

// ==========================================
// 3. TESTS
// ==========================================

test('Hashing Consistency: Builder vs Runtime', (t) => {
    const inputs = [
        'google.com',
        'analytics.google.com',
        'a',
        'xn--bcher-kva.com', // Punycode
        'very.long.domain.name.with.many.subdomains.example.org',
        '', // Empty string edge case
    ];

    for (const input of inputs) {
        // Builder hashes the whole string
        const builderHash = builder_hashString64(input);

        // Runtime hashes the substring (simulating 0 to length)
        const runtimeHash = runtime_hashSubstring64(input, 0, input.length);

        assert.strictEqual(builderHash, runtimeHash, `Hash mismatch for input: "${input}"`);
    }
});

test('Hashing Consistency: Runtime Substring Slicing', (t) => {
    // Verify that the runtime hashing actually respects the start/end indices
    const fullString = 'ignore.target.ignore';
    const target = 'target';
    const start = 7;
    const end = 13;

    // Hash "target" directly using builder logic
    const expectedHash = builder_hashString64(target);

    // Hash "target" embedded in a larger string using runtime logic
    const actualHash = runtime_hashSubstring64(fullString, start, end);

    assert.strictEqual(actualHash, expectedHash, 'Runtime substring hashing failed to extract correct hash');
});

test('Fingerprint Consistency', (t) => {
    // Test a range of hashes to ensure fingerprint extraction is identical
    // We simulate hashes that would produce 0 in the top byte to test the "avoid 0" logic
    const hashCases = [
        0n, // Zero hash
        0xFFFFFFFFFFFFFFFFn, // Max hash
        0x00FFFFFFFFFFFFFFn, // Top byte 0
        0x0100000000000000n, // Top byte 1
    ];

    for (const h of hashCases) {
        const bFp = builder_getFingerprint(h);
        const rFp = runtime_getFingerprint(h);

        assert.strictEqual(bFp, rFp, `Fingerprint mismatch for hash ${h}`);
        assert.ok(bFp >= 1 && bFp <= 255, 'Fingerprint must be between 1 and 255');
    }
});

test('Location Derivation Consistency', (t) => {
    const capacities = [100, 1000, 65536, 1234567];
    const hash = 0x123456789ABCDEF0n; // Arbitrary hash

    for (const cap of capacities) {
        const bLocs = builder_getHashLocations(hash, cap);
        const rLocs = runtime_getHashLocations(hash, cap);

        assert.deepStrictEqual(bLocs, rLocs, `Location mismatch for capacity ${cap}`);

        // Verify bounds
        bLocs.forEach(loc => {
            assert.ok(loc >= 0 && loc < cap, `Location ${loc} out of bounds for capacity ${cap}`);
        });
    }
});