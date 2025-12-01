/**
 * @file build/lib/xor/lib/buildExactXOR.mjs
 * @description The Exact Match XOR Filter Builder Module.
 * This module is responsible for compiling the set of exact-match domains (e.g., `ads.google.com`)
 * into a compact, probabilistic binary XOR Filter.
 *
 * This filter serves as the first line of defense in the runtime lookup chain, allowing for
 * O(1) checks with a negligible False Positive Rate (~0.0015% at 16-bit depth).
 *
 * @module BuildExactXOR
 */

import fs from 'fs';
import path from 'path';
import { buildXORFilter, FINGERPRINT_BITS } from '../buildXORFilter.mjs';
import { startTimer, stopTimer, addBinaryData, formatBytes } from '../../stats/statsCollector.js';
import { BINS_DIR, ARTIFACTS } from '../../../config.mjs';

/**
 * The absolute path where the generated Exact XOR binary will be saved.
 * @constant {string}
 */
const OUTPUT_FILE = path.join(BINS_DIR, ARTIFACTS.EXACT_XOR);

/**
 * Compiles a Set of exact domain strings into a binary XOR Filter and persists it to disk.
 *
 * Workflow:
 * 1. **Validation**: Checks if there are any exact match domains to process.
 * 2. **Construction**: Invokes the generic `buildXORFilter` to solve the linear system and generate fingerprints.
 * 3. **Output**: Writes the resulting binary blob to the configured `BINS_DIR`.
 * 4. **Analysis**: Calculates the theoretical False Positive Rate (FPR) based on the configured fingerprint size.
 * 5. **Telemetry**: Records detailed build metrics (size, entry count, duration, FPR) for the final report.
 *
 * @param {Set<string>} exactMatches - A Set containing unique, lowercase domain strings to be blocked exactly.
 * @returns {void} This function does not return a value; it writes the artifact directly to the file system.
 */
export function buildExactXOR(exactMatches) {
    const timerKey = 'build-exactXOR';
    startTimer(timerKey);
    console.log('- Building Exact Match XOR Filter...');

    if (exactMatches.size === 0) {
        console.warn("  └─ Warning: No exact match domains found. Skipping file creation.");
        stopTimer(timerKey);
        return;
    }

    // Generate the binary filter buffer from the Set of domains
    const filterBinary = buildXORFilter(Array.from(exactMatches));

    // Ensure the output directory exists
    if (!fs.existsSync(BINS_DIR)) {
        fs.mkdirSync(BINS_DIR, { recursive: true });
    }

    // Write the binary artifact to disk
    fs.writeFileSync(OUTPUT_FILE, filterBinary);

    // Calculate theoretical FPR: 1 / (2 ^ bits)
    // e.g., 16 bits = 1/65536 ~= 0.0015%
    const calculatedFPR = 1 / Math.pow(2, FINGERPRINT_BITS);
    const fprString = parseFloat((calculatedFPR * 100).toFixed(4)) + '%';

    // Record build statistics
    addBinaryData({
        name: "Exact Match XOR Filter",
        description: "A probabilistic filter for all exact-match domains.",
        filename: ARTIFACTS.EXACT_XOR,
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