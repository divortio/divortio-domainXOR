/**
 * @file build/steps/build.03.validate.mjs
 * @description The Comprehensive Validation Step (Step 3).
 * This module performs a "Quality Assurance" pass on the final artifacts.
 *
 * Unlike Step 2 (Verification), which checks internal consistency ("Did we store what we read?"),
 * this step checks **External Correctness** ("Does the product meet requirements?"):
 * 1. **Source Mapping**: It maps every domain back to its origin list to identify "Bad Sources".
 * 2. **Wildcard Logic**: It generates synthetic subdomains (e.g., `test.bad-site.com`) to prove that
 * wildcard rules actually block subdomains, not just exact matches.
 * 3. **Reporting**: Generates a summary Markdown report and a detailed TSV debug log.
 *
 * Input: `src/data/lists.json`, `src/data/psl.json`, `src/bins/*.bin`
 * Output: `docs/build/VALIDATION_REPORT.md`, `.cache/validation_failures.tsv`
 *
 * @module BuildValidator
 */

import fs from 'fs';
import path from 'path';
import { buildDomains } from '../lib/domains/buildDomains.mjs';
import { domainExists } from '../../src/lookup.mjs';
import { BINS_DIR, BUILD_DOCS_DIR, DATA_DIR, ARTIFACTS, DATA_FILES, CACHE_DIR } from '../config.mjs';
import { startTimer, stopTimer, formatBytes } from '../lib/stats/statsCollector.js';

/**
 * The absolute path to the generated markdown validation report.
 * @constant {string}
 */
const REPORT_FILE = path.join(BUILD_DOCS_DIR, 'VALIDATION_REPORT.md');

/**
 * The absolute path to the full debug log for failures.
 * @constant {string}
 */
const DEBUG_FILE = path.join(CACHE_DIR, 'validation_failures.tsv');

/**
 * Loads all binary artifacts (XOR filters, Trie, Whitelist) from the disk into memory.
 * Gracefully handles the optional Shadow Whitelist if it was not generated.
 *
 * @returns {{
 * exactXOR: ArrayBuffer,
 * wildcardXOR: ArrayBuffer,
 * pslTrie: ArrayBuffer,
 * shadowWhitelist: ArrayBuffer
 * }} An object containing the raw binary buffers for each loaded artifact.
 */
function loadArtifacts() {
    /** @type {Record<string, ArrayBuffer>} */
    const buffers = {};
    const files = [
        ARTIFACTS.EXACT_XOR,
        ARTIFACTS.WILDCARD_XOR,
        ARTIFACTS.PSL_TRIE,
        ARTIFACTS.SHADOW_WHITELIST
    ];

    files.forEach(filename => {
        const filePath = path.join(BINS_DIR, filename);
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath);
            // Create a clean ArrayBuffer copy
            buffers[filename.replace('.bin', '')] = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length);
        } else if (filename === ARTIFACTS.SHADOW_WHITELIST) {
            buffers['shadowWhitelist'] = new ArrayBuffer(0);
        } else {
            throw new Error(`Critical Artifact Missing: ${filename}`);
        }
    });

    // @ts-ignore - We construct the object dynamically but return strict shape
    return buffers;
}

/**
 * Loads the compiled intermediate data artifacts.
 *
 * @returns {{
 * pslData: Set<string>,
 * listsData: Array<{url: string, domains: string[], count: number}>
 * }}
 */
function loadData() {
    const pslPath = path.join(DATA_DIR, DATA_FILES.PSL);
    const listsPath = path.join(DATA_DIR, DATA_FILES.LISTS);

    if (!fs.existsSync(pslPath) || !fs.existsSync(listsPath)) {
        throw new Error("Missing compiled data. Please run 'build.00.lists.mjs' first.");
    }

    return {
        pslData: new Set(JSON.parse(fs.readFileSync(pslPath, 'utf-8'))),
        listsData: JSON.parse(fs.readFileSync(listsPath, 'utf-8'))
    };
}

/**
 * Writes the debug TSV file for failures.
 * @param {Array<{domain: string, type: string, sources: Set<string>}>} failures
 */
function writeDebugFile(failures) {
    if (failures.length === 0) return;
    const lines = ['Test Domain\tType\tSources'];
    failures.forEach(f => {
        const sourceStr = Array.from(f.sources).join(', ');
        lines.push(`${f.domain}\t${f.type}\t${sourceStr}`);
    });
    fs.writeFileSync(DEBUG_FILE, lines.join('\n'));
    console.log(`   🐛 Full failure log saved to: ${path.relative(process.cwd(), DEBUG_FILE)}`);
}

/**
 * Executes the validation workflow.
 * @async
 */
async function verify() {
    console.log('\n==================================================');
    console.log('   🛡️  DOMAINXOR BUILD COVERAGE VALIDATION  🛡️');
    console.log('==================================================');

    const timerKey = 'validate';
    startTimer(timerKey);

    const buffers = loadArtifacts();

    console.log('\n[1/4] Loading and Mapping Source Data...');
    const { pslData, listsData } = loadData();

    // Map processed domains to their source URLs
    /** @type {Map<string, Set<string>>} */
    const domainSourceMap = new Map();
    /** @type {Set<string>} */
    const rawDomains = new Set();

    listsData.forEach(listObj => {
        const sourceUrl = listObj.url;
        const uniqueInList = new Set(listObj.domains);
        listObj.domains.forEach(d => rawDomains.add(d));

        // Re-run domain classification to ensure mapping matches build logic
        // This tells us if a domain in the list was treated as Exact or Wildcard
        const { exactMatches, wildcardMatches } = buildDomains(uniqueInList, pslData);

        const addToMap = (domain) => {
            if (!domainSourceMap.has(domain)) domainSourceMap.set(domain, new Set());
            domainSourceMap.get(domain).add(sourceUrl);
        };

        exactMatches.forEach(addToMap);
        wildcardMatches.forEach(addToMap);
    });

    console.log(`   ✓ Mapped ${new Intl.NumberFormat('en-US').format(domainSourceMap.size)} unique domains to sources.`);

    console.log('[2/4] Generating Test Cases...');

    /** @type {Array<{domain: string, type: string, base?: string, sources: Set<string>}>} */
    const testCases = [];
    // Re-process master set to get the authoritative list of what SHOULD be blocked
    const { exactMatches, wildcardMatches } = buildDomains(rawDomains, pslData);

    // 1. Exact Match Tests
    for (const d of exactMatches) {
        testCases.push({
            domain: d,
            type: 'Exact',
            sources: domainSourceMap.get(d) || new Set(['Unknown'])
        });
    }

    // 2. Wildcard Tests (Base + Subdomain)
    for (const d of wildcardMatches) {
        const synthetic = `test-val-${Math.floor(Math.random() * 1000)}.${d}`;

        // Test synthetic subdomain (should be blocked)
        testCases.push({
            domain: synthetic,
            type: 'Wildcard (Sub)',
            base: d,
            sources: domainSourceMap.get(d) || new Set(['Unknown'])
        });

        // Test base domain (should be blocked)
        testCases.push({
            domain: d,
            type: 'Wildcard Base',
            sources: domainSourceMap.get(d) || new Set(['Unknown'])
        });
    }

    console.log(`   ✓ Generated ${new Intl.NumberFormat('en-US').format(testCases.length)} test cases.`);
    console.log('\n[3/4] Verifying Coverage...');

    let passed = 0;
    let failed = 0;
    /** @type {Array<{domain: string, type: string, sources: Set<string>}>} */
    const failures = [];

    const start = performance.now();

    // Run the gauntlet
    for (const test of testCases) {
        // The Runtime Check
        if (domainExists(test.domain, buffers)) {
            passed++;
        } else {
            failed++;
            // Keep all failures for the debug log
            failures.push(test);
        }
    }

    const end = performance.now();
    const durationSec = (end - start) / 1000;
    const opsPerSec = Math.floor(testCases.length / durationSec);
    const coverage = ((passed / testCases.length) * 100).toFixed(4);

    console.log(`\n[4/4] Validation Complete.`);
    console.log(`   Coverage:   ${coverage}%`);
    console.log(`   Throughput: ${new Intl.NumberFormat('en-US').format(opsPerSec)} ops/sec`);
    console.log(`   Failures:   ${failed}`);

    // --- Reporting ---

    // 1. Write Debug TSV
    if (failed > 0) {
        writeDebugFile(failures);
    }

    // 2. Write Markdown Summary
    const statusIcon = failed === 0 ? '✅' : '⚠️';
    const reportLines = [];

    reportLines.push(`# 🛡️ Build Coverage Report`);
    reportLines.push(``);
    reportLines.push(`**Date:** ${new Date().toISOString()}  `);
    reportLines.push(`**Status:** ${statusIcon} ${failed === 0 ? 'Success' : 'Failed'}`);
    reportLines.push(``);
    reportLines.push(`## Summary`);
    reportLines.push(`| Metric | Value |`);
    reportLines.push(`| :--- | :--- |`);
    reportLines.push(`| **Total Tests** | ${new Intl.NumberFormat('en-US').format(testCases.length)} |`);
    reportLines.push(`| **Passed** | ${new Intl.NumberFormat('en-US').format(passed)} |`);
    reportLines.push(`| **Failed** | ${new Intl.NumberFormat('en-US').format(failed)} |`);
    reportLines.push(`| **Coverage** | **${coverage}%** |`);
    reportLines.push(`| **Speed** | ${new Intl.NumberFormat('en-US').format(opsPerSec)} ops/sec |`);
    reportLines.push(``);

    if (failed > 0) {
        reportLines.push(`## ⚠️ Failure Analysis`);
        reportLines.push(`**${failed}** domains failed validation.`);
        reportLines.push(`Full log: \`${path.relative(process.cwd(), DEBUG_FILE)}\``);
        reportLines.push(``);
        reportLines.push(`### Sample Failures (Top 50)`);
        reportLines.push(`| Type | Domain | Source List(s) |`);
        reportLines.push(`| :--- | :--- | :--- |`);

        // Safe slice for Markdown to prevent file bloat
        failures.slice(0, 50).forEach(f => {
            const sourceStr = Array.from(f.sources).join('<br>');
            reportLines.push(`| ${f.type} | \`${f.domain}\` | ${sourceStr} |`);
        });

        if (failures.length > 50) {
            reportLines.push(`| ... | ... (${failures.length - 50} more) | ... |`);
        }
    }

    reportLines.push(``);
    reportLines.push(`---`);
    reportLines.push(`*Generated automatically by \`build/steps/build.03.validate.mjs\`*`);

    if (!fs.existsSync(BUILD_DOCS_DIR)) fs.mkdirSync(BUILD_DOCS_DIR, { recursive: true });
    fs.writeFileSync(REPORT_FILE, reportLines.join('\n'));
    console.log(`\n📄 Report saved to: ${path.relative(process.cwd(), REPORT_FILE)}`);

    stopTimer(timerKey);

    if (failed > 0) {
        console.error(`\n❌ Validation Failed: ${failed} domains were not blocked.`);
        process.exit(1);
    }
}

verify().catch(err => {
    console.error(`\n❌ Fatal Error: ${err.message}`);
    process.exit(1);
});