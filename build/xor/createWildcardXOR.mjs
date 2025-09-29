/**
 * @file /build/products/createWildcardXOR.mjs
 * @description A dedicated script to build the binary XOR filter for wildcard domains.
 * This module takes the set of processed wildcard domains and uses the generic
 * xorFilterBuilder to generate the final wildcardXOR.bin artifact. It also
 - * times its execution and reports detailed statistics.
 * @module CreateWildcardXOR
 */

import fs from 'fs';
import path from 'path';
import { buildXORFilter } from '../xorFilterBuilder.mjs';
import { startTimer, stopTimer, addBinaryData, formatBytes } from '../statsCollector.mjs';

const OUTPUT_DIR = path.join(process.cwd(), 'src', 'xor');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'wildcardXOR.bin');

/**
 * Builds and saves the wildcardXOR.bin file.
 *
 * @param {Set<string>} wildcardMatches - A Set containing the base domains for wildcard matches.
 */
export function createWildcardXOR(wildcardMatches) {
    const timerKey = 'build-wildcardXOR';
    startTimer(timerKey);
    console.log('- Building Wildcard Match XOR Filter...');

    // If there are no wildcard domains, log a warning and exit gracefully.
    if (wildcardMatches.size === 0) {
        console.warn("  └─ Warning: No wildcard domains found. Skipping file creation.");
        // Stop the timer even if we do nothing to keep stats consistent.
        stopTimer(timerKey);
        return;
    }

    const filterBinary = buildXORFilter(Array.from(wildcardMatches));

    // Ensure the output directory exists before writing the file.
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_FILE, filterBinary);

    // Report the final statistics for this artifact to the central collector.
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
        falsePositiveRate: 0.003, // Approximate rate for our self-built filter
    });

    console.log(`  └─ Success: Wrote ${formatBytes(filterBinary.length)} to ${OUTPUT_FILE}`);
}