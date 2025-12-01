/**
 * @file build/steps/build.04.report.mjs
 * @description The Final Reporting Step (Step 4).
 * This module aggregates all statistics collected throughout the build pipeline
 * (persisted in `dist/domainXOR/stats/*.js`) and compiles them into human-readable
 * Markdown documentation.
 *
 * Outputs:
 * 1. **BUILD.md**: High-level summary, global metrics, and artifact details.
 * 2. **LISTS.md**: Deep-dive analysis of every source list, including rejection rates and wildcard counts.
 *
 * @module BuildReporter
 */

import fs from 'fs';
import path from 'path';
import { BUILD_DOCS_DIR, STATS_DIR } from '../config.mjs';

/**
 * The absolute path to the main build summary report.
 * @constant {string}
 */
const REPORT_FILE = path.join(BUILD_DOCS_DIR, 'BUILD.md');

/**
 * The absolute path to the detailed source lists report.
 * @constant {string}
 */
const LISTS_REPORT_FILE = path.join(BUILD_DOCS_DIR, 'LISTS.md');

/**
 * Represents the structure of the `lists.js` stats object.
 * @typedef {object} ListStat
 * @property {string} url - Source URL.
 * @property {number} entryCount - Valid domains included.
 * @property {number} wildcardCount - Number of wildcard rules (*.).
 * @property {number} rawCount - Total lines in source file.
 * @property {number} sizeBytes - Size of source file.
 * @property {string} [contentHash] - MD5 hash of source content.
 * @property {number} durationSeconds - Parse time.
 * @property {number} httpStatus - HTTP Status Code.
 * @property {object} [details] - Rejection details.
 * @property {number} details.cosmetic - Dropped cosmetic rules.
 * @property {number} details.exceptions - Dropped exception rules (@@).
 * @property {number} details.urls - Dropped URLs/paths.
 * @property {number} details.ips - Dropped IP addresses.
 * @property {number} details.comments - Comments/empty lines.
 */

/**
 * Dynamically imports a statistics module from the stats directory.
 * Used to load build metrics that may or may not exist (e.g. optional whitelist).
 *
 * @async
 * @param {string} filename - The name of the stats file (e.g. "build.js").
 * @returns {Promise<object|Array<ListStat>|null>} The exported stats data or null.
 */
async function importStats(filename) {
    const filePath = path.join(STATS_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    try {
        const module = await import(filePath);
        return module.stats;
    } catch (e) {
        console.warn(`Warning: Could not import stats from ${filename}:`, e.message);
        return null;
    }
}

/**
 * Formats a table row for Markdown.
 * @param {string[]} columns
 * @returns {string}
 */
function toRow(columns) {
    return `| ${columns.join(' | ')} |`;
}

/**
 * Formats a number with commas.
 * @param {number} [n=0]
 * @returns {string}
 */
function formatNum(n) {
    return new Intl.NumberFormat('en-US').format(n || 0);
}

/**
 * Formats bytes into human-readable string (KB/MB).
 * @param {number} [bytes=0]
 * @returns {string}
 */
function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Generates and writes the detailed LISTS.md report.
 *
 * @param {Array<ListStat>} listStats - Array of list statistics.
 * @param {string} buildDate - Formatted build date string.
 */
function generateListsReport(listStats, buildDate) {
    if (!listStats || !Array.isArray(listStats)) return;

    const lines = [];
    lines.push(`# 📋 Source List Report`);
    lines.push(``);
    lines.push(`**Build Date:** ${buildDate}`);
    lines.push(`**Total Sources:** ${listStats.length}`);
    lines.push(``);

    lines.push(`## Summary Table`);
    lines.push(`| Source | Valid Domains | Wildcards | Raw Size | Hash (MD5) |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);

    // Sort by entry count (descending)
    listStats.sort((a, b) => b.entryCount - a.entryCount);

    for (const l of listStats) {
        let name = l.url.split('/').pop() || l.url;
        // Truncate long names for table readability
        if (name.length > 30) name = name.substring(0, 27) + '...';

        const hashShort = l.contentHash ? `\`${l.contentHash.substring(0, 8)}...\`` : 'N/A';

        lines.push(toRow([
            `[${name}](${l.url})`,
            formatNum(l.entryCount),
            formatNum(l.wildcardCount),
            formatBytes(l.sizeBytes),
            hashShort
        ]));
    }

    lines.push(``);
    lines.push(`## 🔍 Detailed Breakdown`);

    for (const l of listStats) {
        lines.push(`### ${l.url}`);
        lines.push(`- **Status:** HTTP ${l.httpStatus}`);
        lines.push(`- **Time:** ${l.durationSeconds}s`);
        lines.push(`- **Content Hash:** \`${l.contentHash || 'N/A'}\``);
        lines.push(``);
        lines.push(`#### Processing Stats`);
        lines.push(`| Metric | Count | Description |`);
        lines.push(`| :--- | :--- | :--- |`);
        lines.push(`| **Raw Lines** | ${formatNum(l.rawCount)} | Total lines downloaded |`);
        lines.push(`| **Valid Domains** | **${formatNum(l.entryCount)}** | Successfully parsed domains |`);
        lines.push(`| **Wildcards** | ${formatNum(l.wildcardCount)} | Rules starting with \`*.\` or \`||\` |`);

        if (l.details) {
            lines.push(`| **Cosmetic** | ${formatNum(l.details.cosmetic)} | Element hiding rules (##) |`);
            lines.push(`| **Exceptions** | ${formatNum(l.details.exceptions)} | Whitelist rules (@@) |`);
            lines.push(`| **Dropped URLs** | ${formatNum(l.details.urls)} | Lines containing paths/queries |`);
            lines.push(`| **IPs** | ${formatNum(l.details.ips)} | Valid IP addresses (Converted to Exact) |`);
            lines.push(`| **Comments/Empty** | ${formatNum(l.details.comments)} | Skipped lines |`);
        }
        lines.push(``);
    }

    lines.push(`---`);
    lines.push(`*Generated automatically by \`build/steps/build.04.report.mjs\`*`);

    // Ensure docs dir exists
    if (!fs.existsSync(BUILD_DOCS_DIR)) fs.mkdirSync(BUILD_DOCS_DIR, { recursive: true });

    fs.writeFileSync(LISTS_REPORT_FILE, lines.join('\n'));
    console.log(`\n✅ Lists Report generated at: ${path.relative(process.cwd(), LISTS_REPORT_FILE)}`);
}

/**
 * Main execution function.
 * Orchestrates the loading of stats and generation of both reports.
 *
 * @async
 * @returns {Promise<void>}
 */
async function main() {
    console.log("--- Generating Build Reports ---");

    // 1. Import Stats
    const buildStats = await importStats('build.js');
    const listStats = await importStats('lists.js');
    const exactStats = await importStats('exactXOR.js');
    const wildcardStats = await importStats('wildcardXOR.js');
    const pslStats = await importStats('pslTrie.js');
    const whitelistStats = await importStats('shadowWhitelist.js');

    if (!buildStats) {
        throw new Error("Critical: Missing 'build.js' stats. Did the build run complete?");
    }

    const buildDateStr = new Date(buildStats.buildTimestamp).toUTCString();

    // 2. Generate Main Summary (BUILD.md)
    const lines = [];
    lines.push(`# 🏗️ Build Summary Report`);
    lines.push(``);
    lines.push(`**Build Date:** ${buildDateStr}  `);
    lines.push(`**Total Duration:** ${buildStats.totalBuildDurationSeconds} seconds`);
    lines.push(``);

    // Global Metrics Table
    lines.push(`## 📊 Global Metrics`);
    lines.push(`| Metric | Value | Details |`);
    lines.push(`| :--- | :--- | :--- |`);
    lines.push(toRow([`**Total Unique Domains**`, `**${formatNum(buildStats.totalUniqueDomains)}**`, `Processed Domains`]));
    lines.push(toRow([`**Exact Matches**`, `${formatNum(buildStats.exactCount)}`, `Standard Blocks`]));
    lines.push(toRow([`**Wildcards**`, `${formatNum(buildStats.wildcardCount)}`, `\`*.example.com\` Blocks`]));
    lines.push(toRow([`**Raw Input**`, `${formatNum(buildStats.totalRawDomains)}`, `Lines Processed`]));
    lines.push(toRow([`**Artifact Size**`, `**${buildStats.totalSizeBytesH}**`, `Runtime Memory Footprint`]));
    lines.push(``);

    // Artifacts Table
    lines.push(`## 📦 Artifact Details`);
    lines.push(`| Artifact | Entries | Size | Logic |`);
    lines.push(`| :--- | :--- | :--- | :--- |`);

    if (exactStats) {
        lines.push(toRow([
            `**Exact Filter**`,
            formatNum(exactStats.entryCount),
            exactStats.sizeH,
            `16-bit XOR (~0.0015% FPR)`
        ]));
    }
    if (wildcardStats) {
        lines.push(toRow([
            `**Wildcard Filter**`,
            formatNum(wildcardStats.entryCount),
            wildcardStats.sizeH,
            `16-bit XOR (~0.0015% FPR)`
        ]));
    }
    if (pslStats) {
        lines.push(toRow([
            `**PSL Trie**`,
            formatNum(pslStats.entryCount),
            pslStats.sizeH,
            `Binary Trie`
        ]));
    }
    if (whitelistStats) {
        lines.push(toRow([
            `**Shadow Whitelist**`,
            formatNum(whitelistStats.entryCount),
            whitelistStats.sizeH,
            `Binary Search (Rescue)`
        ]));
    }

    lines.push(``);
    lines.push(`## 📥 Source List Overview`);
    lines.push(`> See [LISTS.md](./LISTS.md) for detailed breakdown.`);
    lines.push(``);
    lines.push(`| Source URL | Domains | Wildcards | Size | Status |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);

    if (Array.isArray(listStats)) {
        listStats.sort((a, b) => b.entryCount - a.entryCount);
        for (const list of listStats) {
            const shortUrl = list.url.length > 50 ? list.url.substring(0, 47) + '...' : list.url;
            lines.push(toRow([
                `\`${shortUrl}\``,
                formatNum(list.entryCount),
                formatNum(list.wildcardCount || 0),
                formatBytes(list.sizeBytes),
                list.httpStatus === 200 ? '✅ 200' : (list.httpStatus === 304 ? '⚡ 304' : `⚠️ ${list.httpStatus}`),
            ]));
        }
    }

    lines.push(``);
    lines.push(`---`);
    lines.push(`*Generated automatically by \`build/steps/build.04.report.mjs\`*`);

    // Write BUILD.md
    if (!fs.existsSync(BUILD_DOCS_DIR)) fs.mkdirSync(BUILD_DOCS_DIR, { recursive: true });
    fs.writeFileSync(REPORT_FILE, lines.join('\n'));
    console.log(`\n✅ Build Report generated at: ${path.relative(process.cwd(), REPORT_FILE)}`);

    // 3. Generate LISTS.md
    generateListsReport(listStats, buildDateStr);
}

// Execute
main().catch(err => {
    console.error("Report generation failed:", err);
    process.exit(1);
});