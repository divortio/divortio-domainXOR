/**
 * @file build/buildReport.mjs
 * @description Generates a comprehensive Markdown build report from collected statistics
 * AND prints a high-level "Funnel" summary to the console.
 */

import fs from 'fs';
import path from 'path';
import { STATS_DIR, BUILD_DIR } from '../config.mjs';

// --- Helper: Dynamic Imports for stats files ---
async function loadStats() {
    const buildStatsPath = path.join(STATS_DIR, 'build.js');
    const exactStatsPath = path.join(STATS_DIR, 'exactXOR.js');
    const wildcardStatsPath = path.join(STATS_DIR, 'wildcardXOR.js');
    const pslStatsPath = path.join(STATS_DIR, 'pslTrie.js');
    const listsStatsPath = path.join(STATS_DIR, 'lists.js');

    const safeImport = async (p) => {
        try {
            const module = await import(p);
            return module.stats;
        } catch (e) { return null; }
    };

    return {
        build: await safeImport(buildStatsPath),
        exact: await safeImport(exactStatsPath),
        wildcard: await safeImport(wildcardStatsPath),
        psl: await safeImport(pslStatsPath),
        lists: await safeImport(listsStatsPath) || []
    };
}

// --- Helper: Formatting ---
function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num || 0);
}

function calculatePercentage(part, total) {
    if (!total) return '0%';
    return ((part / total) * 100).toFixed(1) + '%';
}

// --- Helper: Console Output ---
function printConsoleSummary(data, funnel) {
    const { build, exact, wildcard, psl } = data;

    console.log('\n==================================================');
    console.log('   🚀  DIVORTIO DOMAINXOR BUILD SUMMARY  🚀');
    console.log('==================================================');

    console.log('\n--- Data Pipeline Funnel ---');
    console.log(`1. Ingested (Raw Lines):  ${formatNumber(funnel.totalRawLines)}`);
    console.log(`2. Parsed (Valid Rules):  ${formatNumber(funnel.totalParsed)} (${calculatePercentage(funnel.totalParsed, funnel.totalRawLines)} retention)`);
    console.log(`3. Consolidated (Unique): ${formatNumber(funnel.totalUnique)} (${calculatePercentage(funnel.totalUnique, funnel.totalParsed)} unique)`);
    console.log(`   └─ Duplicates Removed: ${formatNumber(funnel.duplicatesRemoved)}`);

    console.log('\n--- Artifact Analysis ---');
    const tableData = [
        { name: 'Exact Filter', entries: formatNumber(exact.entryCount), size: exact.sizeH, fpr: exact.falsePositiveRate },
        { name: 'Wildcard Filter', entries: formatNumber(wildcard.entryCount), size: wildcard.sizeH, fpr: wildcard.falsePositiveRate },
        { name: 'PSL Trie', entries: formatNumber(psl.entryCount), size: psl.sizeH, fpr: 'N/A' }
    ];
    console.table(tableData);

    console.log(`\nTotal Build Time: ${build.totalBuildDurationSeconds}s`);
    console.log('==================================================\n');
}

// --- Main Generator ---
async function buildReport() {
    const data = await loadStats();
    if (!data.build) {
        console.error('❌ Critical: Build stats not found. Cannot generate report.');
        process.exit(1);
    }

    const { build, exact, wildcard, psl, lists } = data;

    // Calculate Funnel Metrics
    // 'rawCount' is captured in fetchList.mjs. Fallback to entryCount if missing (legacy builds).
    const totalRawLines = lists.reduce((sum, l) => sum + (l.rawCount || l.entryCount), 0);
    const totalParsed = build.totalRawDomains; // Sum of all parsed domains
    const totalUnique = build.totalUniqueDomains; // Size of the final deduplicated Set
    const duplicatesRemoved = totalParsed - totalUnique;

    const funnel = { totalRawLines, totalParsed, totalUnique, duplicatesRemoved };

    // 1. Print Console Summary
    printConsoleSummary(data, funnel);

    // 2. Generate Markdown Report
    const reportDate = new Date(build.buildTimestamp).toLocaleString();

    let md = `# 🛡️ Divortio DomainXOR Build Report
**Build Date:** ${reportDate}  
**Status:** ✅ Success

## 🌪️ Data Processing Funnel
Visualizing the optimization pipeline from raw source data to the final blocklist.

| Stage | Count | Description |
| :--- | :--- | :--- |
| **1. Ingested** | **${formatNumber(totalRawLines)}** | Total raw lines fetched from ${build.sourceListCount} source lists. |
| **2. Parsed** | ${formatNumber(totalParsed)} | Valid domain/wildcard rules extracted (comments/garbage removed). |
| **3. Unique** | **${formatNumber(totalUnique)}** | Unique rules remaining after deduplication. |
| **4. Dropped** | 📉 ${formatNumber(duplicatesRemoved)} | Duplicate rules removed during consolidation. |

---

## 📦 Artifact Analysis
The build generated **${build.binaries.length}** binary artifacts optimized for the Cloudflare Worker runtime.

| Artifact | Type | Entries | Size | FPR* | Path |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Exact Filter** | 8-bit XOR | ${formatNumber(exact.entryCount)} | ${exact.sizeH} | ${exact.falsePositiveRate} | [\`${exact.filename}\`](../bins/${exact.filename}) |
| **Wildcard Filter** | 8-bit XOR | ${formatNumber(wildcard.entryCount)} | ${wildcard.sizeH} | ${wildcard.falsePositiveRate} | [\`${wildcard.filename}\`](../bins/${wildcard.filename}) |
| **PSL Trie** | Binary Trie | ${formatNumber(psl.entryCount)} | ${psl.sizeH} | N/A | [\`${psl.filename}\`](../bins/${psl.filename}) |

<small>*FPR: Theoretical False Positive Rate based on 8-bit fingerprints.</small>

---

## 📡 Source Intelligence
Analysis of the upstream blocklists. **Efficiency** indicates how many valid rules were extracted relative to file size.

| Source List | Raw Lines | Valid Rules | Size | Speed | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
`;

    const sortedLists = [...lists].sort((a, b) => b.entryCount - a.entryCount);

    for (const list of sortedLists) {
        const shortUrl = list.url.length > 45 ? list.url.substring(0, 42) + '...' : list.url;
        const speed = list.durationSeconds < 0.5 ? `⚡ ${list.durationSeconds}s` : `${list.durationSeconds}s`;
        // If rawCount is missing, fallback to N/A to avoid confusion
        const raw = list.rawCount ? formatNumber(list.rawCount) : 'N/A';

        md += `| [${shortUrl}](${list.url}) | ${raw} | **${formatNumber(list.entryCount)}** | ${formatBytes(list.sizeBytes)} | ${speed} | ${list.httpStatus === 200 ? '✅' : '⚠️ ' + list.httpStatus} |\n`;
    }

    md += `
---
*Generated automatically by the Divortio DomainXOR Build System.*
`;

    const outputPath = path.join(BUILD_DIR, 'BUILD_REPORT.md');
    fs.writeFileSync(outputPath, md);
    console.log(`✅ Report generated: ${path.relative(process.cwd(), outputPath)}`);
}

buildReport();