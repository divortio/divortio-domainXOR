/**
 * @file build/lib/stats/statsCollector.js
 * @description A centralized module for collecting, aggregating, and persisting build metrics.
 *
 * UPDATED: Implements "Read-Merge-Write" logic.
 * Since build steps run in separate processes, this module now reads existing stats files
 * from disk before writing, ensuring that later steps append/update data rather than
 * overwriting it with empty state.
 *
 * @module StatsCollector
 */

import fs from 'fs';
import path from 'path';
import { STATS_DIR, ARTIFACTS } from '../../config.mjs';

/**
 * Global internal state for the CURRENT process.
 */
const currentProcessStats = {
    lists: [],
    binaries: [],
    timers: new Map(),
};

export function startTimer(key) {
    currentProcessStats.timers.set(key, performance.now());
}

export function stopTimer(key) {
    const startTime = currentProcessStats.timers.get(key);
    if (!startTime) return 0;
    const durationMs = performance.now() - startTime;
    currentProcessStats.timers.delete(key);
    return parseFloat((durationMs / 1000).toFixed(3));
}

export function addListData(listData) {
    if (listData.rawCount === undefined) listData.rawCount = listData.entryCount;
    currentProcessStats.lists.push(listData);
}

export function addBinaryData(binaryData) {
    currentProcessStats.binaries.push(binaryData);
}

export function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Helper to read an existing stats file safely.
 * @param {string} fileName
 * @returns {Promise<object|Array|null>}
 */
async function readExistingStats(fileName) {
    const filePath = path.join(STATS_DIR, fileName);
    if (!fs.existsSync(filePath)) return null;
    try {
        // Cache-busting import to ensure we get the latest disk content
        const module = await import(`${filePath}?t=${Date.now()}`);
        return module.stats;
    } catch (e) {
        return null;
    }
}

/**
 * Writes a stats object to a JS module file.
 * @param {string} fileName
 * @param {object|Array} data
 */
function writeStatsFile(fileName, data) {
    if (!fs.existsSync(STATS_DIR)) {
        fs.mkdirSync(STATS_DIR, { recursive: true });
    }
    const fullPath = path.join(STATS_DIR, fileName);
    const content = `export const stats = ${JSON.stringify(data, null, 4)};`;
    fs.writeFileSync(fullPath, content);
    console.log(`  - Updated stats: ${path.relative(process.cwd(), fullPath)}`);
}

/**
 * Persists all collected statistics.
 * Merges current process data with existing disk data to prevent data loss between steps.
 *
 * @param {object} [summaryUpdate] - Optional updates for the main build.js summary.
 * @returns {Promise<void>}
 */
export async function writeAllStats(summaryUpdate = {}) {
    console.log("\n[Stats] Persisting build metrics...");

    // 1. Merge Binary Stats (Individual Files)
    // We simply write whatever binaries were generated in THIS process.
    // Binaries are distinct (exactXOR, pslTrie), so overwriting their specific file is fine/correct.
    for (const binary of currentProcessStats.binaries) {
        let fileName = '';
        if (binary.filename === ARTIFACTS.EXACT_XOR) fileName = 'exactXOR.js';
        else if (binary.filename === ARTIFACTS.WILDCARD_XOR) fileName = 'wildcardXOR.js';
        else if (binary.filename === ARTIFACTS.PSL_TRIE) fileName = 'pslTrie.js';
        else if (binary.filename === ARTIFACTS.SHADOW_WHITELIST) fileName = 'shadowWhitelist.js';

        if (fileName) writeStatsFile(fileName, binary);
    }

    // 2. Merge Lists Stats (lists.js)
    // We read existing lists from disk and append/update with current process lists.
    let mergedLists = (await readExistingStats('lists.js')) || [];
    if (!Array.isArray(mergedLists)) mergedLists = [];

    // Merge strategy: Overwrite if URL matches (update), else append
    for (const newList of currentProcessStats.lists) {
        const index = mergedLists.findIndex(l => l.url === newList.url);
        if (index !== -1) {
            mergedLists[index] = newList;
        } else {
            mergedLists.push(newList);
        }
    }
    // Only write if we actually have data (to avoid writing empty array on steps that don't touch lists)
    if (mergedLists.length > 0) {
        writeStatsFile('lists.js', mergedLists);
    }

    // 3. Merge Master Build Summary (build.js)
    let buildSummary = (await readExistingStats('build.js')) || {};

    // Merge simple fields
    buildSummary = { ...buildSummary, ...summaryUpdate };

    // Recalculate Totals based on ALL known binaries (disk + current)
    // We need to scan the stats dir or known artifacts to get the true total size
    // For simplicity, we'll trust the inputs provided in summaryUpdate,
    // but we must ensure 'binaries' array is cumulative.

    // Update binary paths list
    const currentBinaryPaths = currentProcessStats.binaries.map(b => b.path);
    const existingBinaryPaths = buildSummary.binaries || [];
    buildSummary.binaries = [...new Set([...existingBinaryPaths, ...currentBinaryPaths])];

    // Update list URLs
    const currentListUrls = currentProcessStats.lists.map(l => l.url);
    const existingListUrls = buildSummary.lists || [];
    buildSummary.lists = [...new Set([...existingListUrls, ...currentListUrls])];

    // Recalculate total size from all known binary stats files on disk
    let totalBytes = 0;
    const statFiles = ['exactXOR.js', 'wildcardXOR.js', 'pslTrie.js', 'shadowWhitelist.js'];
    for (const f of statFiles) {
        const s = await readExistingStats(f);
        if (s && s.sizeBytes) totalBytes += s.sizeBytes;
    }
    if (totalBytes > 0) {
        buildSummary.totalSizeBytes = totalBytes;
        buildSummary.totalSizeBytesH = formatBytes(totalBytes);
    }

    writeStatsFile('build.js', buildSummary);
}