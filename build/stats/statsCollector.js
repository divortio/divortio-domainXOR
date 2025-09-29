/**
 * @file /build/statsCollector.mjs
 * @description A centralized module for collecting, timing, and writing build statistics.
 * @module StatsCollector
 */

import fs from 'fs';
import path from 'path';

/**
 * @typedef {object} ListStats
 * @property {string} url - The source URL of the list.
 * @property {number} entryCount - The number of valid domains parsed from the list.
 * @property {number} sizeBytes - The raw size of the downloaded file in bytes.
 * @property {number} durationSeconds - The time taken to download and parse the list.
 * @property {number} httpStatus - The HTTP status code of the successful download.
 */

/**
 * @typedef {object} BinaryStats
 * @property {string} name - The human-readable name of the binary artifact.
 * @property {string} description - A brief description of the artifact's purpose.
 * @property {string} filename - The output filename.
 * @property {string} path - The path to the file from the project root.
 * @property {number} entryCount - The number of items encoded into the binary.
 * @property {number} sizeBytes - The final size of the binary file in bytes.
 * @property {string} sizeH - The final size in a human-readable format.
 * @property {string} buildTimestamp - The ISO 8601 timestamp of when the build finished.
 * @property {number} buildDurationSeconds - The time taken to build this specific binary.
 * @property {number} [falsePositiveRate] - The estimated false positive rate for probabilistic filters.
 */

export const stats = {
    /** @type {ListStats[]} */
    lists: [],
    /** @type {BinaryStats[]} */
    binaries: [],
    timers: new Map(),
};

/**
 * Starts a high-resolution timer for a given key.
 * @param {string} key - A unique key for the timer.
 */
export function startTimer(key) {
    stats.timers.set(key, performance.now());
}

/**
 * Stops a high-resolution timer and returns the duration in seconds.
 * @param {string} key - The unique key for the timer to stop.
 * @returns {number} The duration in seconds.
 */
export function stopTimer(key) {
    const startTime = stats.timers.get(key);
    if (!startTime) return 0;
    const durationMs = performance.now() - startTime;
    stats.timers.delete(key);
    return parseFloat((durationMs / 1000).toFixed(3));
}

/**
 * Adds statistics for a processed source list.
 * @param {ListStats} listData - The statistics for the processed list.
 */
export function addListData(listData) {
    stats.lists.push(listData);
}

/**
 * Adds statistics for a generated binary artifact.
 * @param {BinaryStats} binaryData - The statistics for the generated binary.
 */
export function addBinaryData(binaryData) {
    stats.binaries.push(binaryData);
}

/**
 * Converts bytes to a human-readable string.
 * @param {number} bytes - The number of bytes.
 * @returns {string} The formatted string.
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Writes all collected statistics to their respective files in the output directory.
 * @param {object} summary - An object containing overall build summary stats.
 */
export function writeAllStats(summary) {
    const outputDir = path.join(process.cwd(), 'src', 'xor', 'stats');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const writeFile = (fileName, data) => {
        const fullPath = path.join(outputDir, fileName);
        const content = `export const stats = ${JSON.stringify(data, null, 4)};`;
        fs.writeFileSync(fullPath, content);
        console.log(`  - Wrote stats to ${fullPath}`);
    };

    console.log("\n[Step 5/5] Writing build statistics...");

    // Write individual binary stats
    const pslTrieStats = stats.binaries.find(b => b.filename === 'pslTrie.bin');
    if (pslTrieStats) writeFile('pslTrie.js', pslTrieStats);

    const exactXORStats = stats.binaries.find(b => b.filename === 'exactXOR.bin');
    if (exactXORStats) writeFile('exactXOR.js', exactXORStats);

    const wildcardXORStats = stats.binaries.find(b => b.filename === 'wildcardXOR.bin');
    if (wildcardXORStats) writeFile('wildcardXOR.js', wildcardXORStats);

    // Write list stats
    writeFile('lists.js', stats.lists);

    // Write overall build summary
    const buildSummary = {
        ...summary,
        totalSizeBytesH: formatBytes(summary.totalSizeBytes),
        binaries: stats.binaries.map(b => b.path),
        lists: stats.lists.map(l => l.url),
    };
    writeFile('build.js', buildSummary);
}