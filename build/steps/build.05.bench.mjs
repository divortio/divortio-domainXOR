/**
 * @file build/steps/build.05.bench.mjs
 * @description The Performance Benchmarking Step (Step 5).
 * This module assesses the runtime performance of the generated binary artifacts by executing
 * a high-throughput lookup benchmark against the "Tranco Top 1 Million" dataset.
 *
 * It performs the following actions:
 * 1. **Data Preparation**: Checks for the Tranco CSV in the cache; downloads and extracts it if missing (Self-Healing).
 * 2. **Artifact Loading**: Loads the generated XOR filters, Trie, and Shadow Whitelist into memory.
 * 3. **Execution**: Runs a tight loop checking 1 million domains against the filter to measure ops/sec.
 * 4. **Reporting**: Calculates metrics (throughput, latency, memory delta, block rate) and generates Markdown reports.
 *
 * @module BuildBenchmark
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { domainExists } from '../../src/lookup.mjs';
import { BINS_DIR, BENCH_DIR, CACHE_DIR, TRANCO_URL, ARTIFACTS } from '../config.mjs';

/**
 * The directory used to store temporary benchmark datasets (Zip/CSV).
 * Located inside the cache directory so it is cleaned up by `build.06.cleanup.mjs`.
 * @constant {string}
 */
const BENCH_DATA_DIR = path.join(CACHE_DIR, 'bench_data');

/**
 * The absolute path to the local Tranco Zip file.
 * @constant {string}
 */
const TRANCO_ZIP_PATH = path.join(BENCH_DATA_DIR, 'tranco_full.zip');

/**
 * The absolute path to the extracted Tranco CSV file.
 * @constant {string}
 */
const CSV_PATH = path.join(BENCH_DATA_DIR, 'top-1m.csv');

/**
 * The absolute path where the latest benchmark report will be saved.
 * @constant {string}
 */
const REPORT_FILE = path.join(BENCH_DIR, 'BENCH.md');

/**
 * Represents the system hardware info for the benchmark report.
 * @typedef {object} SystemInfo
 * @property {string} cpu - The CPU model name (e.g., "Intel Core i9").
 * @property {number} cores - The number of logical CPU cores available.
 * @property {string} speed - The CPU clock speed in MHz.
 * @property {string} arch - The CPU architecture (e.g., "x64", "arm64").
 * @property {string} totalMem - The total system memory formatted as a string (e.g., "16.00 GB").
 * @property {string} platform - The operating system platform (e.g., "linux", "darwin").
 * @property {string} release - The operating system release version.
 * @property {string} nodeVersion - The Node.js runtime version.
 * @property {string} v8Version - The V8 engine version.
 */

/**
 * Retrieves system hardware information to contextualize benchmark results.
 * @returns {SystemInfo} An object containing CPU, memory, and OS metadata.
 */
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

/**
 * Formats a number with locale-specific separators (e.g., 1,000,000).
 * @param {number} num - The number to format.
 * @returns {string} The formatted number string.
 */
function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Downloads a file from a URL with automatic retry logic.
 *
 * @async
 * @param {string} url - The remote URL to fetch.
 * @param {number} [retries=3] - The maximum number of retry attempts.
 * @param {number} [delay=2000] - The delay in milliseconds between retries.
 * @returns {Promise<ArrayBuffer>} A promise that resolves to the file content buffer.
 * @throws {Error} If the network request fails after all retries.
 */
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
    throw new Error("Unreachable");
}

/**
 * Reads a specific binary artifact file from the bins directory.
 *
 * @param {string} filename - The name of the file to load (from ARTIFACTS).
 * @param {boolean} required - Whether to throw an error if the file is missing.
 * @returns {ArrayBuffer} The file contents as an ArrayBuffer, or an empty buffer if optional and missing.
 * @throws {Error} If a required file is missing.
 */
function readArtifactFile(filename, required) {
    const filePath = path.join(BINS_DIR, filename);
    if (!fs.existsSync(filePath)) {
        if (required) throw new Error(`Artifact missing: ${filePath}`);
        return new ArrayBuffer(0);
    }
    const raw = fs.readFileSync(filePath);
    // Create a clean ArrayBuffer copy to ensure correct byte offsets for the runtime
    return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length);
}

/**
 * Loads all generated binary artifacts from disk into memory.
 * explicit mapping ensures the runtime receives the correct keys.
 *
 * @returns {{
 * exactXOR: ArrayBuffer,
 * wildcardXOR: ArrayBuffer,
 * pslTrie: ArrayBuffer,
 * shadowWhitelist: ArrayBuffer
 * }} An object containing the raw binary buffers for the runtime.
 */
function loadArtifacts() {
    try {
        return {
            exactXOR: readArtifactFile(ARTIFACTS.EXACT_XOR, true),
            wildcardXOR: readArtifactFile(ARTIFACTS.WILDCARD_XOR, true),
            pslTrie: readArtifactFile(ARTIFACTS.PSL_TRIE, true),
            shadowWhitelist: readArtifactFile(ARTIFACTS.SHADOW_WHITELIST, false)
        };
    } catch (e) {
        console.error(`❌ Failed to load artifacts: ${e.message}`);
        process.exit(1);
    }
}

/**
 * Executes the main benchmark workflow.
 *
 * Workflow:
 * 1. **Setup**: Loads artifacts and system info.
 * 2. **Data Prep**: Downloads and unzips the Tranco Top 1M list (self-healing cache).
 * 3. **Parsing**: Reads the CSV into an array of domain strings.
 * 4. **Execution**: Measures the time taken to check 1 million domains.
 * 5. **Reporting**: Outputs results to console and saves timestamped Markdown reports.
 *
 * @async
 * @function main
 * @returns {Promise<void>} A promise that resolves when the benchmark is complete.
 */
async function main() {
    console.log('\n==================================================');
    console.log('   🚀 DOMAINXOR PERFORMANCE BENCHMARK');
    console.log('==================================================');

    const sys = getSystemInfo();
    const buffers = loadArtifacts();

    // 1. Data Preparation (Self-Healing Cache)
    console.log('[1/4] Checking Benchmark Data...');

    if (!fs.existsSync(BENCH_DATA_DIR)) {
        fs.mkdirSync(BENCH_DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(TRANCO_ZIP_PATH)) {
        console.log(`   ⬇️ Downloading Tranco Top 1M from ${TRANCO_URL}...`);
        try {
            const arrayBuffer = await fetchWithRetry(TRANCO_URL);
            fs.writeFileSync(TRANCO_ZIP_PATH, Buffer.from(arrayBuffer));
        } catch (e) {
            console.error(`❌ Failed to download dataset: ${e.message}`);
            process.exit(1);
        }
    }

    if (!fs.existsSync(CSV_PATH)) {
        console.log('   📦 Extracting dataset...');
        try {
            execSync(`unzip -p "${TRANCO_ZIP_PATH}" > "${CSV_PATH}"`);
        } catch (e) {
            console.error('❌ Failed to unzip dataset. Ensure "unzip" is installed.');
            process.exit(1);
        }
    }

    // 2. Parse
    console.log('   📄 Parsing CSV...');
    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = content.split('\n');
    /** @type {string[]} */
    const domains = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Tranco format: "1,google.com"
        const parts = trimmed.split(',');
        if (parts.length >= 2) domains.push(parts[1]);
    }

    const datasetSize = domains.length;
    console.log(`   ✓ Loaded ${formatNumber(datasetSize)} unique domains.`);

    // 3. Execute Benchmark
    console.log(`\n[2/4] Executing Benchmark Loop...`);

    // Warmup V8 JIT
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

    // 5. Console Output
    console.log('\n[3/4] Results Analysis');
    console.log('--------------------------------------------------');
    console.log(`• System:        ${sys.cpu} (${sys.arch})`);
    console.log(`• Throughput:    ${formatNumber(opsPerSec)} ops/sec`);
    console.log(`• Latency:       ${latencyMs.toFixed(5)} ms/req`);
    console.log(`• Blocked:       ${formatNumber(blockedCount)} (${blockedPercent}%)`);
    console.log('--------------------------------------------------');

    // 6. Generate Markdown Reports
    console.log('\n[4/4] Generating Reports...');

    const timestamp = new Date().toISOString();
    const markdown = `# DomainXOR Performance Benchmark

**Date:** ${timestamp}  
**Source:** [Tranco Top 1M](${TRANCO_URL})

## System Configuration
| Component | Details |
| :--- | :--- |
| **CPU Model** | ${sys.cpu} |
| **Cores** | ${sys.cores} |
| **Architecture** | ${sys.arch} |
| **Memory** | ${sys.totalMem} |
| **Node/V8** | ${sys.nodeVersion} / ${sys.v8Version} |

## Results
| Metric | Value | Unit |
| :--- | :--- | :--- |
| **Throughput** | **${formatNumber(opsPerSec)}** | Ops/Sec |
| **Avg Latency** | ${latencyMs.toFixed(5)} | ms/req |
| **Memory Delta** | ${memDeltaMB.toFixed(2)} | MB |
| **Blocked Rate** | ${blockedPercent}% | (${formatNumber(blockedCount)} domains) |

---
*Generated automatically by \`build/steps/build.05.bench.mjs\`*
`;

    // Ensure output dir exists
    if (!fs.existsSync(BENCH_DIR)) {
        fs.mkdirSync(BENCH_DIR, { recursive: true });
    }

    // Write Timestamped Report (e.g., BENCH_2023-10-27T10-00-00.000Z.md)
    const safeTime = timestamp.replace(/:/g, '-');
    const timestampFile = path.join(BENCH_DIR, `BENCH_${safeTime}.md`);
    fs.writeFileSync(timestampFile, markdown);
    console.log(`✅ Saved Timestamped Report: ${path.relative(process.cwd(), timestampFile)}`);

    // Write Latest Report (Overwrite)
    fs.writeFileSync(REPORT_FILE, markdown);
    console.log(`✅ Updated Latest Report:      ${path.relative(process.cwd(), REPORT_FILE)}`);
}

// Execute the benchmark
main().catch(err => {
    console.error(err);
    process.exit(1);
});