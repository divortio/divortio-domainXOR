/**
 * @file build/xor/buildExactXOR.mjs
 * @description Builds the Exact Match XOR Filter.
 * @module CreateExactXOR
 */

import fs from 'fs';
import path from 'path';
import { buildXORFilter, FINGERPRINT_BITS } from '../buildXORFilter.mjs';
import { startTimer, stopTimer, addBinaryData, formatBytes } from '../../stats/statsCollector.js';
import { BINS_DIR } from '../../../config.mjs';

const OUTPUT_FILE = path.join(BINS_DIR, 'exactXOR.bin');

export function buildExactXOR(exactMatches) {
    const timerKey = 'build-exactXOR';
    startTimer(timerKey);
    console.log('- Building Exact Match XOR Filter...');

    if (exactMatches.size === 0) {
        console.warn("  └─ Warning: No exact match domains found. Skipping file creation.");
        stopTimer(timerKey);
        return;
    }

    const filterBinary = buildXORFilter(Array.from(exactMatches));

    if (!fs.existsSync(BINS_DIR)) {
        fs.mkdirSync(BINS_DIR, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_FILE, filterBinary);

    const calculatedFPR = 1 / Math.pow(2, FINGERPRINT_BITS);
    const fprString = parseFloat((calculatedFPR * 100).toFixed(4)) + '%';

    addBinaryData({
        name: "Exact Match XOR Filter",
        description: "A probabilistic filter for all exact-match domains.",
        filename: 'exactXOR.bin',
        path: path.relative(process.cwd(), OUTPUT_FILE),
        entryCount: exactMatches.size,
        sizeBytes: filterBinary.length,
        sizeH: formatBytes(filterBinary.length),
        buildTimestamp: new Date().toISOString(),
        buildDurationSeconds: stopTimer(timerKey),
        falsePositiveRate: fprString
    });

    console.log(`  └─ Success: Wrote ${formatBytes(filterBinary.length)} to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}