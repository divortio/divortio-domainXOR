/**
 * @file /build/products/createExactXOR.mjs
 * @description A dedicated script to build the binary XOR filter for exact match domains.
 * @module CreateExactXOR
 */

import fs from 'fs';
import path from 'path';
import { buildXORFilter } from './xorFilterBuilder.mjs';
import { startTimer, stopTimer, addBinaryData, formatBytes } from '../stats/statsCollector.js';

const OUTPUT_DIR = path.join(process.cwd(), 'src', 'xor');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'exactXOR.bin');

/**
 * Builds and saves the exactXOR.bin file.
 * @param {Set<string>} exactMatches - A Set containing all exact match domains.
 */
export function createExactXOR(exactMatches) {
    const timerKey = 'build-exactXOR';
    startTimer(timerKey);
    console.log('- Building Exact Match XOR Filter...');

    if (exactMatches.size === 0) {
        console.warn("  └─ Warning: No exact match domains found. Skipping file creation.");
        return;
    }

    const filterBinary = buildXORFilter(Array.from(exactMatches));

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_FILE, filterBinary);

    // Report final statistics to the collector
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
        falsePositiveRate: 0.003, // Approximate rate for this implementation
    });

    console.log(`  └─ Success: Wrote ${formatBytes(filterBinary.length)} to ${OUTPUT_FILE}`);
}