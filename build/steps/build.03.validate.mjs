/**
 * @file build/steps/build.03.validate.mjs
 * @description The Comprehensive Validation Step (Step 3).
 * This module performs a "Quality Assurance" pass on the final artifacts.
 *
 * UPDATED:
 * - **DNS Safety**: Filters out test cases that exceed `MAX_DOMAIN_LENGTH` (253 chars).
 * This prevents false negatives where the runtime correctly rejects an invalid domain
 * but the validator expected a block.
 *
 * @module BuildValidator
 */

import fs from 'fs';
import path from 'path';
import { buildDomains } from '../lib/domains/buildDomains.mjs';
import { domainExists } from '../../src/lookup.mjs';
import { BINS_DIR, BUILD_DOCS_DIR, DATA_DIR, ARTIFACTS, DATA_FILES, CACHE_DIR, MAX_DOMAIN_LENGTH } from '../config.mjs';
import { startTimer, stopTimer, formatBytes } from '../lib/stats/statsCollector.js';
import { cyrb53 } from '../lib/hash/lib/cyrb53.mjs';

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

function loadArtifacts() {
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
            buffers[filename.replace('.bin', '')] = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length);
        } else if (filename === ARTIFACTS.SHADOW_WHITELIST) {
            buffers['shadowWhitelist'] = new ArrayBuffer(0);
        } else {
            throw new Error(`Critical Artifact Missing: ${filename}`);
        }
    });

    return buffers;
}

function loadData() {
    const pslPath = path.join(DATA_DIR, DATA_FILES.PSL);
    const listsPath = path.join(DATA_DIR, DATA_FILES.LISTS);

    if (!fs.existsSync(pslPath) || !fs.existsSync(listsPath)) {
        throw new Error("Missing compiled data artifacts. Please run 'build.00.lists.mjs' first.");
    }

    return {
        pslData: new Set(JSON.parse(fs.readFileSync(pslPath, 'utf-8'))),
        listsData: JSON.parse(fs.readFileSync(listsPath, 'utf-8'))
    };
}

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

function binarySearch(arr, val) {
    let left = 0, right = arr.length - 1;
    while (left <= right) {
        const mid = (left + right) >>> 1;
        const midVal = arr[mid];
        if (midVal < val) left = mid + 1;
        else if (midVal > val) right = mid - 1;
        else return true;
    }
    return false;
}

async function verify() {
    console.log('\n==================================================');
    console.log('   🛡️  DOMAINXOR BUILD COVERAGE VALIDATION  🛡️');
    console.log('==================================================');

    const timerKey = 'validate';
    startTimer(timerKey);

    const buffers = loadArtifacts();
    const whitelistView = buffers.shadowWhitelist ? new Uint32Array(buffers.shadowWhitelist) : new Uint32Array(0);

    console.log('\n[1/4] Loading and Mapping Source Data...');
    const { pslData, listsData } = loadData();

    const domainSourceMap = new Map();
    const rawDomains = new Set();

    listsData.forEach(listObj => {
        const sourceUrl = listObj.url;
        const uniqueInList = new Set(listObj.domains);
        listObj.domains.forEach(d => rawDomains.add(d));

        // Re-run domain classification logic
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

    const testCases = [];
    const { exactMatches, wildcardMatches } = buildDomains(rawDomains, pslData);

    // 1. Exact Match Tests
    for (const d of exactMatches) {
        // Skip if the source domain itself is invalid (too long)
        if (d.length > MAX_DOMAIN_LENGTH) continue;

        testCases.push({
            domain: d,
            type: 'Exact',
            base: d,
            sources: domainSourceMap.get(d) || new Set(['Unknown'])
        });
    }

    // 2. Wildcard Tests (Base + Subdomain)
    for (const d of wildcardMatches) {
        const synthetic = `test-val-${Math.floor(Math.random() * 1000)}.${d}`;

        // Test synthetic subdomain (should be blocked)
        // CRITICAL FIX: Check length before adding. Runtime rejects > 253 chars.
        if (synthetic.length <= MAX_DOMAIN_LENGTH) {
            testCases.push({
                domain: synthetic,
                type: 'Wildcard (Sub)',
                base: d,
                sources: domainSourceMap.get(d) || new Set(['Unknown'])
            });
        }

        // Test base domain (should be blocked)
        if (d.length <= MAX_DOMAIN_LENGTH) {
            testCases.push({
                domain: d,
                type: 'Wildcard Base',
                base: d,
                sources: domainSourceMap.get(d) || new Set(['Unknown'])
            });
        }
    }

    console.log(`   ✓ Generated ${new Intl.NumberFormat('en-US').format(testCases.length)} test cases.`);
    console.log('\n[3/4] Verifying Coverage...');

    let passed = 0, failed = 0, rescued = 0;
    const failures = [];
    const start = performance.now();

    for (const test of testCases) {
        const isBlocked = domainExists(test.domain, buffers);

        if (isBlocked) {
            passed++;
        } else {
            // FAILED to block.
            // Check if this was an intentional rescue (Whitelist Override)
            const baseHash = cyrb53(test.base).h1;
            const isWhitelisted = binarySearch(whitelistView, baseHash);

            if (isWhitelisted) {
                rescued++;
                passed++;
            } else {
                failed++;
                failures.push(test);
            }
        }
    }

    const end = performance.now();
    // @ts-ignore
    const durationSec = (end - start) / 1000;
    const opsPerSec = Math.floor(testCases.length / durationSec);
    const coverage = ((passed / testCases.length) * 100).toFixed(4);

    console.log(`\n[4/4] Validation Complete.`);
    console.log(`   Coverage:   ${coverage}%`);
    console.log(`   Rescued:    ${rescued} (Intentional Overrides)`);
    console.log(`   Throughput: ${new Intl.NumberFormat('en-US').format(opsPerSec)} ops/sec`);
    console.log(`   Failures:   ${failed}`);

    // --- Reporting ---
    if (failed > 0) writeDebugFile(failures);

    const statusIcon = failed === 0 ? '✅' : '⚠️';
    const markdown = `# 🛡️ Build Coverage Report
**Date:** ${new Date().toISOString()}  
**Status:** ${statusIcon} ${failed === 0 ? 'Success' : 'Failed'}

## Summary
| Metric | Value |
| :--- | :--- |
| **Total Tests** | ${new Intl.NumberFormat('en-US').format(testCases.length)} |
| **Passed** | ${new Intl.NumberFormat('en-US').format(passed)} |
| **Rescued** | ${new Intl.NumberFormat('en-US').format(rescued)} |
| **Failed** | ${new Intl.NumberFormat('en-US').format(failed)} |
| **Coverage** | **${coverage}%** |

${failed > 0 ? `## ⚠️ Failures\nSee \`.cache/validation_failures.tsv\`` : ''}
`;

    if (!fs.existsSync(BUILD_DOCS_DIR)) fs.mkdirSync(BUILD_DOCS_DIR, { recursive: true });
    fs.writeFileSync(REPORT_FILE, markdown);
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