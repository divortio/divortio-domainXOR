/**
 * @file build/lib/stats/statsCollector.js
 * @description A centralized module for collecting, aggregating, and persisting build metrics.
 * It tracks performance timers, list parsing statistics, and binary artifact metadata throughout
 * the build pipeline, finally writing them to JSON/JS files for reporting and historical analysis.
 *
 * @module StatsCollector
 */

import fs from 'fs';
import path from 'path';
import { STATS_DIR, ARTIFACTS } from '../../config.mjs';

/**
 * @typedef {object} ListData
 * @property {string} url - The source URL of the list.
 * @property {number} entryCount - The number of unique valid domains extracted.
 * @property {number} rawCount - The total number of lines/entries in the raw file.
 * @property {number} sizeBytes - The size of the raw content in bytes.
 * @property {number} durationSeconds - The time taken to fetch and parse the list.
 * @property {number} httpStatus - The HTTP status code returned (or 304 for cache).
 */

/**
 * @typedef {object} BinaryData
 * @property {string} name - The human-readable name of the artifact.
 * @property {string} description - A brief description of the artifact's purpose.
 * @property {string} filename - The filename of the generated binary (from ARTIFACTS).
 * @property {string} path - The relative path to the binary file.
 * @property {number} entryCount - The number of items (domains/hashes) stored.
 * @property {number} sizeBytes - The size of the binary in bytes.
 * @property {string} sizeH - The human-readable size string (e.g., "2.4 MB").
 * @property {string} buildTimestamp - ISO 8601 timestamp of creation.
 * @property {number} buildDurationSeconds - Time taken to generate the artifact.
 * @property {string} [falsePositiveRate] - The theoretical false positive rate (if applicable).
 */

/**
 * Global internal state for collecting statistics during the build process.
 * @type {{
 * lists: ListData[],
 * binaries: BinaryData[],
 * timers: Map<string, number>
 * }}
 */
const globalStats = {
    lists: [],
    binaries: [],
    timers: new Map(),
};

/**
 * Starts a high-resolution performance timer for a specific operation.
 *
 * @param {string} key - A unique identifier for the timer (e.g., "fetch-google.com").
 * @returns {void}
 */
export function startTimer(key) {
    globalStats.timers.set(key, performance.now());
}

/**
 * Stops a previously started timer and calculates the duration in seconds.
 * If the timer key does not exist, returns 0.
 *
 * @param {string} key - The unique identifier of the timer to stop.
 * @returns {number} The duration of the operation in seconds, formatted to 3 decimal places.
 */
export function stopTimer(key) {
    const startTime = globalStats.timers.get(key);
    if (!startTime) {
        return 0;
    }
    const durationMs = performance.now() - startTime;
    globalStats.timers.delete(key);
    return parseFloat((durationMs / 1000).toFixed(3));
}

/**
 * Records statistics for a successfully fetched and parsed domain list.
 *
 * @param {ListData} listData - The metrics object containing details about the fetched list.
 * @returns {void}
 */
export function addListData(listData) {
    // Ensure rawCount is present, default to entryCount if missing (legacy support)
    if (listData.rawCount === undefined) {
        listData.rawCount = listData.entryCount;
    }
    globalStats.lists.push(listData);
}

/**
 * Records metadata and statistics for a generated binary artifact (e.g., XOR filter, Trie).
 *
 * @param {BinaryData} binaryData - The metrics object containing details about the generated binary.
 * @returns {void}
 */
export function addBinaryData(binaryData) {
    globalStats.binaries.push(binaryData);
}

/**
 * Formats a number of bytes into a human-readable string (e.g., "1.5 MB").
 *
 * @param {number} bytes - The size in bytes.
 * @param {number} [decimals=2] - The number of decimal places to include in the output.
 * @returns {string} A human-readable string representation of the size.
 */
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Writes all collected statistics to JSON-like JS modules in the configured stats directory.
 * This function persists data for individual artifacts and a master build summary.
 *
 * @param {object} summary - A generic summary object containing high-level build info (e.g., total duration, timestamp).
 * @returns {void}
 */
export function writeAllStats(summary) {
    if (!fs.existsSync(STATS_DIR)) {
        fs.mkdirSync(STATS_DIR, { recursive: true });
    }

    /**
     * Helper to write a specific stats object to a JS module file.
     * @param {string} fileName - The name of the output JS file (e.g., "exactXOR.js").
     * @param {object} data - The data object to serialize.
     */
    const writeFile = (fileName, data) => {
        const fullPath = path.join(STATS_DIR, fileName);
        const content = `export const stats = ${JSON.stringify(data, null, 4)};`;
        fs.writeFileSync(fullPath, content);
        console.log(`  - Wrote stats to ${path.relative(process.cwd(), fullPath)}`);
    };

    console.log("\n[Step 5/5] Writing build statistics...");

    // 1. PSL Trie Stats
    const pslTrieStats = globalStats.binaries.find(b => b.filename === ARTIFACTS.PSL_TRIE);
    if (pslTrieStats) writeFile('pslTrie.js', pslTrieStats);

    // 2. Exact Match XOR Stats
    const exactXORStats = globalStats.binaries.find(b => b.filename === ARTIFACTS.EXACT_XOR);
    if (exactXORStats) writeFile('exactXOR.js', exactXORStats);

    // 3. Wildcard XOR Stats
    const wildcardXORStats = globalStats.binaries.find(b => b.filename === ARTIFACTS.WILDCARD_XOR);
    if (wildcardXORStats) writeFile('wildcardXOR.js', wildcardXORStats);

    // 4. Shadow Whitelist Stats
    const whitelistStats = globalStats.binaries.find(b => b.filename === ARTIFACTS.SHADOW_WHITELIST);
    if (whitelistStats) writeFile('shadowWhitelist.js', whitelistStats);

    // 5. Source List Stats
    writeFile('lists.js', globalStats.lists);

    // 6. Master Build Summary
    const buildSummary = {
        ...summary,
        totalSizeBytes: globalStats.binaries.reduce((sum, b) => sum + b.sizeBytes, 0),
        totalSizeBytesH: formatBytes(globalStats.binaries.reduce((sum, b) => sum + b.sizeBytes, 0)),
        binaries: globalStats.binaries.map(b => b.path),
        lists: globalStats.lists.map(l => l.url),
    };
    writeFile('build.js', buildSummary);
}