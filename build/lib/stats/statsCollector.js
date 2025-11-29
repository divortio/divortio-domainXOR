/**
 * @file build/lib/statsCollector.js
 * @description A centralized module for collecting build metrics.
 * Updated to use shared configuration for output paths and support Funnel metrics.
 * @module StatsCollector
 */

import fs from 'fs';
import path from 'path';
import { STATS_DIR } from '../../config.mjs';

const globalStats = {
    /** @type {Array<{url: string, entryCount: number, rawCount: number, sizeBytes: number, durationSeconds: number, httpStatus: number}>} */
    lists: [],
    /** @type {Array<object>} */
    binaries: [],
    /** @type {Map<string, number>} */
    timers: new Map(),
};

export function startTimer(key) {
    globalStats.timers.set(key, performance.now());
}

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
 * @param {{
 * url: string,
 * entryCount: number,
 * rawCount: number,
 * sizeBytes: number,
 * durationSeconds: number,
 * httpStatus: number
 * }} listData - The metrics object for the list.
 * @returns {void}
 */
export function addListData(listData) {
    // Ensure rawCount is present, default to entryCount if missing (legacy support)
    if (listData.rawCount === undefined) {
        listData.rawCount = listData.entryCount;
    }
    globalStats.lists.push(listData);
}

export function addBinaryData(binaryData) {
    globalStats.binaries.push(binaryData);
}

export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function writeAllStats(summary) {
    if (!fs.existsSync(STATS_DIR)) {
        fs.mkdirSync(STATS_DIR, { recursive: true });
    }

    const writeFile = (fileName, data) => {
        const fullPath = path.join(STATS_DIR, fileName);
        const content = `export const stats = ${JSON.stringify(data, null, 4)};`;
        fs.writeFileSync(fullPath, content);
        console.log(`  - Wrote stats to ${path.relative(process.cwd(), fullPath)}`);
    };

    console.log("\n[Step 5/5] Writing build statistics...");

    const pslTrieStats = globalStats.binaries.find(b => b.filename === 'pslTrie.bin');
    if (pslTrieStats) writeFile('pslTrie.js', pslTrieStats);

    const exactXORStats = globalStats.binaries.find(b => b.filename === 'exactXOR.bin');
    if (exactXORStats) writeFile('exactXOR.js', exactXORStats);

    const wildcardXORStats = globalStats.binaries.find(b => b.filename === 'wildcardXOR.bin');
    if (wildcardXORStats) writeFile('wildcardXOR.js', wildcardXORStats);

    writeFile('lists.js', globalStats.lists);

    const buildSummary = {
        ...summary,
        totalSizeBytes: globalStats.binaries.reduce((sum, b) => sum + b.sizeBytes, 0),
        totalSizeBytesH: formatBytes(globalStats.binaries.reduce((sum, b) => sum + b.sizeBytes, 0)),
        binaries: globalStats.binaries.map(b => b.path),
        lists: globalStats.lists.map(l => l.url),
    };
    writeFile('build.js', buildSummary);
}