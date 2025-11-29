/**
 * @file build/xor/buildWildcardXOR.mjs
 * @description Builds the Wildcard Match XOR Filter.
 * @module CreateWildcardXOR
 */

import fs from 'fs';
import path from 'path';
import { buildXORFilter, FINGERPRINT_BITS } from '../buildXORFilter.mjs';
import { startTimer, stopTimer, addBinaryData, formatBytes } from '../../stats/statsCollector.js';
import { BINS_DIR } from '../../../config.mjs';

const OUTPUT_FILE = path.join(BINS_DIR, 'wildcardXOR.bin');

export function buildWildcardXOR(wildcardMatches) {
    const timerKey = 'build-wildcardXOR';
    startTimer(timerKey);
    console.log('- Building Wildcard Match XOR Filter...');

    if (wildcardMatches.size === 0) {
        console.warn("  └─ Warning: No wildcard domains found. Skipping file creation.");
        stopTimer(timerKey);
        return;
    }

    const filterBinary = buildXORFilter(Array.from(wildcardMatches));

    if (!fs.existsSync(BINS_DIR)) {
        fs.mkdirSync(BINS_DIR, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_FILE, filterBinary);

    const calculatedFPR = 1 / Math.pow(2, FINGERPRINT_BITS);
    const fprString = parseFloat((calculatedFPR * 100).toFixed(4)) + '%';

    addBinaryData({
        name: "Wildcard Match XOR Filter",
        description: "A probabilistic filter for the parent domains of wildcard rules.",
        filename: 'wildcardXOR.bin',
        path: path.relative(process.cwd(), OUTPUT_FILE),
        entryCount: wildcardMatches.size,
        sizeBytes: filterBinary.length,
        sizeH: formatBytes(filterBinary.length),
        buildTimestamp: new Date().toISOString(),
        buildDurationSeconds: stopTimer(timerKey),
        falsePositiveRate: fprString
    });

    console.log(`  └─ Success: Wrote ${formatBytes(filterBinary.length)} to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}