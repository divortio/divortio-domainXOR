/**
 * @file build/lib/xor/lib/buildWildcardXOR.mjs
 * @description The Wildcard Match XOR Filter Builder Module.
 * This module is responsible for compiling the set of wildcard parent domains
 * (e.g., "example.com" derived from a rule like "*.example.com") into a compact,
 * probabilistic binary XOR Filter.
 *
 * This filter allows the runtime to quickly check if a domain might be subject to
 * wildcard blocking before performing more expensive checks or Trie traversals.
 *
 * @module BuildWildcardXOR
 */

import fs from 'fs';
import path from 'path';
import { buildXORFilter, FINGERPRINT_BITS } from '../buildXORFilter.mjs';
import { startTimer, stopTimer, addBinaryData, formatBytes } from '../../stats/statsCollector.js';
import { BINS_DIR, ARTIFACTS } from '../../../config.mjs';

/**
 * The absolute path where the generated Wildcard XOR binary will be saved.
 * @constant {string}
 */
const OUTPUT_FILE = path.join(BINS_DIR, ARTIFACTS.WILDCARD_XOR);

/**
 * Compiles a Set of wildcard base domains into a binary XOR Filter and persists it to disk.
 *
 * Workflow:
 * 1. **Validation**: Checks if there are any wildcard domains to process.
 * 2. **Construction**: Invokes the generic `buildXORFilter` to solve the linear system and generate fingerprints.
 * 3. **Output**: Writes the resulting binary blob to the configured `BINS_DIR`.
 * 4. **Analysis**: Calculates the theoretical False Positive Rate (FPR) based on the configured fingerprint size.
 * 5. **Telemetry**: Records detailed build metrics (size, entry count, duration, FPR) for the final report.
 *
 * @param {Set<string>} wildcardMatches - A Set containing unique, lowercase parent domains derived from wildcard rules.
 * @returns {void} This function does not return a value; it writes the artifact directly to the file system.
 */
export function buildWildcardXOR(wildcardMatches) {
    const timerKey = 'build-wildcardXOR';
    startTimer(timerKey);
    console.log('- Building Wildcard Match XOR Filter...');

    if (wildcardMatches.size === 0) {
        console.warn("  └─ Warning: No wildcard domains found. Skipping file creation.");
        stopTimer(timerKey);
        return;
    }

    // Generate the binary filter buffer from the Set of domains
    const filterBinary = buildXORFilter(Array.from(wildcardMatches));

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
        name: "Wildcard Match XOR Filter",
        description: "A probabilistic filter for the parent domains of wildcard rules.",
        filename: ARTIFACTS.WILDCARD_XOR,
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