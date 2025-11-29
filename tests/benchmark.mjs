/**
 * @file test/benchmark.mjs
 * @description Performance benchmark suite for DomainXOR lookup engine.
 * Measures throughput, latency, and correctness against real-world traffic data.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { domainExists } from '../src/lib/lookup.mjs';
import { BINS_DIR } from '../build/config.mjs';

const TRANCO_URL = 'https://tranco-list.eu/top-1m.csv.zip';
const DATA_DIR = path.join(process.cwd(), 'test');
const TRANCO_ZIP_PATH = path.join(DATA_DIR, 'tranco_full.zip');
const CSV_PATH = path.join(DATA_DIR, 'top-1m.csv');
const REPORT_FILE = path.join(process.cwd(), 'build-benchmark.md');
const STATS_DIR = path.join(process.cwd(), 'src/built/stats');

// --- Helper: System Information ---
function getSystemInfo() {
    const cpus = os.cpus();
    const cpuModel = cpus[0] ? cpus[0].model : 'Unknown';
    const totalMemGB = (os.totalmem() / (1024 ** 3)).toFixed(2) + ' GB';

    return {
        cpu: cpuModel,
        cores: cpus.length,
        speed: cpus[0] ? cpus[0].speed + ' MHz' : 'N/A',
        arch: os.arch(),
        totalMem: totalMemGB,
        platform: os.platform(),
        release: os.release(),
        nodeVersion: process.version,
        v8Version: process.versions.v8
    };
}

// --- Helper: Load Build Stats ---
async function loadBuildStats() {
    try {
        // Dynamically import stats to avoid failures if files don't exist yet
        const build = (await import(path.join(STATS_DIR, 'build.js'))).stats;
        const exact = (await import(path.join(STATS_DIR, 'exactXOR.js'))).stats;
        const wildcard = (await import(path.join(STATS_DIR, 'wildcardXOR.js'))).stats;
        const psl = (await import(path.join(STATS_DIR, 'pslTrie.js'))).stats;
        const lists = (await import(path.join(STATS_DIR, 'lists.js'))).stats;
        return { build, exact, wildcard, psl, lists };
    } catch (e) {
        return null;
    }
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
    return new Intl.NumberFormat('en-US').format(num);
}

// --- Helper: Retry Logic ---
async function fetchWithRetry(url, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.arrayBuffer();
        } catch (e) {
            if (i === retries - 1) throw e;
            console.warn(`   ⚠️ Download failed (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// --- Main Benchmark Logic ---
async function run() {
    const sys = getSystemInfo();
    const buildStats = await loadBuildStats();

    // 1. Load Artifacts
    console.log('[1/4] Loading Binary Artifacts...');
    const buffers = {};
    try {
        ['exactXOR.bin', 'wildcardXOR.bin', 'pslTrie.bin'].forEach(filename => {
            const raw = fs.readFileSync(path.join(BINS_DIR, filename));
            buffers[filename.replace('.bin', '')] = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length);
        });
    } catch (e) {
        console.error(`❌ Failed to load artifacts: ${e.message}`);
        process.exit(1);
    }

    // 2. Prepare Dataset
    console.log('[2/4] Preparing Dataset (Tranco Top 1M)...');

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    if (!fs.existsSync(TRANCO_ZIP_PATH)) {
        console.log(`   Downloading from ${TRANCO_URL}...`);
        try {
            const arrayBuffer = await fetchWithRetry(TRANCO_URL);
            fs.writeFileSync(TRANCO_ZIP_PATH, Buffer.from(arrayBuffer));
        } catch (e) {
            console.error(`❌ Failed to download dataset: ${e.message}`);
            process.exit(1);
        }
    }

    if (!fs.existsSync(CSV_PATH)) {
        console.log('   Extracting dataset...');
        try {
            execSync(`unzip -p "${TRANCO_ZIP_PATH}" > "${CSV_PATH}"`);
        } catch (e) {
            console.error('❌ Failed to unzip dataset. Ensure "unzip" is installed.');
            process.exit(1);
        }
    }

    console.log('   Parsing CSV...');
    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = content.split('\n');
    const domains = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(',');
        if (parts.length >= 2) domains.push(parts[1]);
    }

    const datasetSize = domains.length;
    console.log(`   ✓ Loaded ${formatNumber(datasetSize)} unique domains.`);

    // 3. Execute Benchmark
    console.log(`\n[3/4] Executing Benchmark Loop...`);

    // Warmup
    domainExists('google.com', buffers);

    const startMem = process.memoryUsage().heapUsed;
    const start = performance.now();

    let blockedCount = 0;
    for (let i = 0; i < datasetSize; i++) {
        if (domainExists(domains[i], buffers)) {
            blockedCount++;
        }
    }

    const end = performance.now();
    const endMem = process.memoryUsage().heapUsed;

    // 4. Analysis
    const durationMs = end - start;
    const durationSec = durationMs / 1000;
    const opsPerSec = Math.floor(datasetSize / durationSec);
    const latencyMs = 1000 / opsPerSec;
    const memDeltaMB = (endMem - startMem) / 1024 / 1024;
    const blockedPercent = ((blockedCount / datasetSize) * 100).toFixed(2);

    // 5. Report Generation
    console.log('\n[4/4] Generating Report...');

    // --- Console Output ---
    console.log('\n==================================================');
    console.log('   DOMAINXOR PERFORMANCE BENCHMARK');
    console.log('==================================================');

    console.log('\n--- System Configuration ---');
    console.log(`• CPU:           ${sys.cpu}`);
    console.log(`• Cores:         ${sys.cores}`);
    console.log(`• Clock Speed:   ${sys.speed}`);
    console.log(`• Arch:          ${sys.arch}`);
    console.log(`• Memory:        ${sys.totalMem}`);
    console.log(`• OS:            ${sys.platform} (${sys.release})`);
    console.log(`• Node / V8:     ${sys.nodeVersion} / ${sys.v8Version}`);

    console.log('\n--- Benchmark Results ---');
    console.log(`• Dataset:       ${formatNumber(datasetSize)} domains (Tranco 1M)`);
    console.log(`• Time:          ${durationSec.toFixed(4)} s`);
    console.log(`• Throughput:    ${formatNumber(opsPerSec)} ops/sec`);
    console.log(`• Latency:       ${latencyMs.toFixed(5)} ms/req`);
    console.log(`• Memory Delta:  ${memDeltaMB.toFixed(2)} MB`);
    console.log(`• Blocked:       ${formatNumber(blockedCount)} (${blockedPercent}%)`);

    if (buildStats) {
        const { exact, wildcard, psl, lists } = buildStats;
        console.log('\n--- Artifact Stats ---');
        const artifacts = [
            { Type: 'Exact Filter', Entries: formatNumber(exact.entryCount), Size: exact.sizeH, FPR: exact.falsePositiveRate },
            { Type: 'Wildcard Filter', Entries: formatNumber(wildcard.entryCount), Size: wildcard.sizeH, FPR: wildcard.falsePositiveRate },
            { Type: 'PSL Trie', Entries: formatNumber(psl.entryCount), Size: psl.sizeH, FPR: 'N/A' }
        ];
        console.table(artifacts);

        console.log('\n--- Source Lists ---');
        const sortedLists = [...lists].sort((a, b) => b.entryCount - a.entryCount);
        // Simplified list output for console to fit width
        const listSummary = sortedLists.map(l => ({
            Source: l.url.length > 40 ? l.url.substring(0, 37) + '...' : l.url,
            Entries: formatNumber(l.entryCount),
            Size: formatBytes(l.sizeBytes),
            Status: l.httpStatus
        }));
        console.table(listSummary);
    }
    console.log('==================================================\n');


    // --- Markdown Generation ---
    let markdown = `# DomainXOR Performance Benchmark

**Date:** ${new Date().toISOString()}

## System Configuration
| Component | Details |
| :--- | :--- |
| **CPU Model** | ${sys.cpu} |
| **Cores / Threads** | ${sys.cores} |
| **Clock Speed** | ${sys.speed} |
| **Architecture** | ${sys.arch} |
| **Memory (RAM)** | ${sys.totalMem} |
| **OS Platform** | ${sys.platform} (${sys.release}) |
| **Node.js Version** | ${sys.nodeVersion} |
| **V8 Engine** | ${sys.v8Version} |

## Benchmark Results
| Metric | Value | Unit |
| :--- | :--- | :--- |
| **Dataset Size** | ${formatNumber(datasetSize)} | Domains |
| **Time Elapsed** | ${durationSec.toFixed(4)} | Seconds |
| **Throughput** | **${formatNumber(opsPerSec)}** | Ops/Sec |
| **Avg Latency** | ${latencyMs.toFixed(5)} | ms/req |
| **Memory Delta** | ${memDeltaMB.toFixed(2)} | MB |
| **Blocked Rate** | ${blockedPercent}% | (${formatNumber(blockedCount)} domains) |

## Benchmark Source
* **Dataset Source:** [Tranco Top 1M](${TRANCO_URL})
* **Input File:** \`top-1m.csv\`
`;

    if (buildStats) {
        const { exact, wildcard, psl, lists } = buildStats;
        markdown += `
## Binary Artifact Statistics
| Artifact | Type | Entries | Size | FPR |
| :--- | :--- | :--- | :--- | :--- |
| **Exact Filter** | 8-bit XOR | ${formatNumber(exact.entryCount)} | ${exact.sizeH} | ${exact.falsePositiveRate} |
| **Wildcard Filter** | 8-bit XOR | ${formatNumber(wildcard.entryCount)} | ${wildcard.sizeH} | ${wildcard.falsePositiveRate} |
| **PSL Trie** | Binary Trie | ${formatNumber(psl.entryCount)} | ${psl.sizeH} | N/A |

## Source Lists Statistics
| Source | Entries | Raw Lines | Size | Status |
| :--- | :--- | :--- | :--- | :--- |
`;
        const sortedLists = [...lists].sort((a, b) => b.entryCount - a.entryCount);
        for (const l of sortedLists) {
            const shortUrl = l.url.length > 50 ? l.url.substring(0, 47) + '...' : l.url;
            const raw = l.rawCount ? formatNumber(l.rawCount) : 'N/A';
            markdown += `| ${shortUrl} | ${formatNumber(l.entryCount)} | ${raw} | ${formatBytes(l.sizeBytes)} | ${l.httpStatus} |\n`;
        }
    }

    // Append Markdown to Console
    console.log('\n--- Markdown Report Output ---');
    console.log(markdown);

    // Output to File
    fs.writeFileSync(REPORT_FILE, markdown);
    console.log(`✅ Report saved to: ${REPORT_FILE}`);

    // Cleanup CSV (keep ZIP)
    if (fs.existsSync(CSV_PATH)) fs.unlinkSync(CSV_PATH);
}

run();