/**
 * @file build/lib/trie/lib/buildPSLTrie.mjs
 * @description The PSL Trie Builder Module.
 * This module is responsible for compiling the Public Suffix List (PSL) set into a
 * compact binary Trie format. This artifact is essential for the runtime (`lookup.mjs`)
 * to correctly identify the "Effective Top-Level Domain" (eTLD) of a given hostname
 * (e.g., distinguishing `co.uk` from `google.co.uk`), which enables accurate wildcard blocking.
 *
 * @module BuildPSLTrie
 */

import fs from 'fs';
import path from 'path';
import { buildTrie } from '../buildTrie.mjs';
import { startTimer, stopTimer, addBinaryData, formatBytes } from '../../stats/statsCollector.js';
import { BINS_DIR, ARTIFACTS } from '../../../config.mjs';

/**
 * The absolute path where the generated PSL Trie binary will be saved.
 * @constant {string}
 */
const OUTPUT_FILE = path.join(BINS_DIR, ARTIFACTS.PSL_TRIE);

/**
 * Compiles a Set of public suffixes into a serialized binary Trie and persists it to disk.
 *
 * Workflow:
 * 1. **Validation**: Checks if the input PSL data is non-empty.
 * 2. **Compilation**: Uses `buildTrie` to flatten and serialize the suffix tree.
 * 3. **Output**: Writes the binary buffer to the configured `BINS_DIR`.
 * 4. **Telemetry**: Records build statistics (size, entry count, duration) for the final report.
 *
 * @param {Set<string>} pslData - A Set containing unique, lowercase public suffixes (e.g., "com", "co.uk").
 * @returns {void} This function does not return a value; it writes the artifact directly to the file system.
 * @throws {Error} Throws if `pslData` is empty or if file write permissions are denied.
 */
export function buildPSLTrie(pslData) {
    const timerKey = 'build-pslTrie';
    startTimer(timerKey);
    console.log('- Building PSL Trie...');

    if (pslData.size === 0) {
        throw new Error("Cannot build PSL Trie: PSL data is empty.");
    }

    /**
     * A callback function used by the Trie builder to determine the flag value for a terminal node.
     * For the PSL, every entry in the set is a valid suffix, so we mark it with the terminal flag `1`.
     *
     * @param {string} item - The specific suffix being processed (unused here as all flags are constant).
     * @returns {number} The integer flag to store in the Trie node (always 1).
     */
    const flagSetter = (item) => 1;

    // Compile the Trie
    const trieBinary = buildTrie(Array.from(pslData), flagSetter);

    // Ensure the output directory exists
    if (!fs.existsSync(BINS_DIR)) {
        fs.mkdirSync(BINS_DIR, { recursive: true });
    }

    // Write artifact to disk
    fs.writeFileSync(OUTPUT_FILE, trieBinary);

    // Collect statistics
    addBinaryData({
        name: "Public Suffix List Trie",
        description: "A binary Trie of all public suffixes used to determine domain boundaries.",
        filename: ARTIFACTS.PSL_TRIE,
        path: path.relative(process.cwd(), OUTPUT_FILE),
        entryCount: pslData.size,
        sizeBytes: trieBinary.length,
        sizeH: formatBytes(trieBinary.length),
        buildTimestamp: new Date().toISOString(),
        buildDurationSeconds: stopTimer(timerKey)
    });

    console.log(`  └─ Success: Wrote ${formatBytes(trieBinary.length)} to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}