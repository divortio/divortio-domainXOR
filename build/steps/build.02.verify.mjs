/**
 * @file test/build.02.verify.mjs
 * @description Post-build verification script.
 * Loads the generated binary artifacts and performs sanity checks.
 */

import fs from 'fs';
import path from 'path';
import { domainExists } from '../../src/lookup.mjs';
import { BINS_DIR } from '../config.mjs';

const ARTIFACTS = ['exactXOR.bin', 'wildcardXOR.bin', 'pslTrie.bin'];

async function verify() {
    console.log('\n--- Verifying Build Artifacts ---');
    console.log(`Checking directory: ${BINS_DIR}`);

    const buffers = {};
    try {
        for (const filename of ARTIFACTS) {
            const filePath = path.join(BINS_DIR, filename);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Missing artifact: ${filename}`);
            }
            const stats = fs.statSync(filePath);
            if (stats.size === 0) {
                throw new Error(`Empty artifact: ${filename} (0 bytes)`);
            }

            const rawBuf = fs.readFileSync(filePath);
            buffers[filename.replace('.bin', '')] = rawBuf.buffer.slice(
                rawBuf.byteOffset,
                rawBuf.byteOffset + rawBuf.length
            );

            console.log(`✅ Found ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        }
    } catch (e) {
        console.error(`❌ Artifact Check Failed: ${e.message}`);
        process.exit(1);
    }

    console.log('\n--- Running Functional Sanity Checks ---');

    const lookupBuffers = {
        exactXOR: buffers.exactXOR,
        wildcardXOR: buffers.wildcardXOR,
        pslTrie: buffers.pslTrie
    };

    const testCases = [
        { domain: 'google.com', shouldBlock: false, desc: 'Major Safe Domain' },
        { domain: 'microsoft.com', shouldBlock: false, desc: 'Major Safe Domain' },
        { domain: 'doubleclick.net', shouldBlock: true, desc: 'Known Ad Domain (Wildcard)' },
        { domain: 'ad.doubleclick.net', shouldBlock: true, desc: 'Known Ad Subdomain' },
        { domain: 'googleadservices.com', shouldBlock: true, desc: 'Known Ad Domain (Exact/Wild)' }
    ];

    let failures = 0;

    for (const test of testCases) {
        const result = domainExists(test.domain, lookupBuffers);
        const status = result === test.shouldBlock ? 'PASS' : 'FAIL';
        const icon = result === test.shouldBlock ? '✅' : '❌';

        console.log(`${icon} [${status}] ${test.domain}: Expected=${test.shouldBlock}, Got=${result} (${test.desc})`);

        if (result !== test.shouldBlock) {
            failures++;
        }
    }

    if (failures > 0) {
        console.error(`\n❌ Verification Failed: ${failures} sanity checks failed.`);
        process.exit(1);
    } else {
        console.log('\n✅ Build Verification Passed: Artifacts are valid and functional.');
        process.exit(0);
    }
}

verify();