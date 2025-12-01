/**
 * @file build/steps/build.02.verify.mjs
 * @description The Verification Step (Step 2).
 * Performs "Sanity Checks" and "Smoke Tests" on the generated artifacts.
 *
 * Updated to support Two-Tier Validation:
 * 1. **CRITICAL Tests (Fatal)**: `critical.mjs` - Infrastructure that MUST resolve.
 * 2. **RECOMMENDED Tests (Warning)**: `recommended.mjs` - Major sites that *should* resolve.
 *
 * @module BuildVerifier
 */

import fs from 'fs';
import path from 'path';
import { domainExists } from '../../src/lookup.mjs';
import { BINS_DIR, BUILD_DOCS_DIR, ARTIFACTS } from '../config.mjs';
import { formatBytes } from '../lib/stats/statsCollector.js';
import { CRITICAL_DOMAINS } from '../lists/allow/critical.mjs';
import { RECOMMENDED_DOMAINS } from '../lists/allow/recommended.mjs';

const REPORT_FILE = path.join(BUILD_DOCS_DIR, 'VERIFY_ARTIFACTS.md');

function loadArtifact(filename) {
    const filePath = path.join(BINS_DIR, filename);
    if (!fs.existsSync(filePath)) {
        if (filename === ARTIFACTS.SHADOW_WHITELIST) return { buffer: new ArrayBuffer(0), size: 0 };
        throw new Error(`❌ Artifact Missing: ${filename}`);
    }
    const stats = fs.statSync(filePath);
    if (stats.size === 0 && filename !== ARTIFACTS.SHADOW_WHITELIST) {
        throw new Error(`❌ Artifact Empty: ${filename}`);
    }
    const raw = fs.readFileSync(filePath);
    return {
        buffer: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length),
        size: stats.size
    };
}

// Standard Block Tests (These MUST be blocked)
const BLOCK_TESTS = [
    { domain: 'doubleclick.net', expectBlock: true, category: 'Ad Network' },
    { domain: 'ad.doubleclick.net', expectBlock: true, category: 'Ad Subdomain' },
    { domain: 'google-analytics.com', expectBlock: true, category: 'Tracker' },
    { domain: 'scorecardresearch.com', expectBlock: true, category: 'Tracker' }
];

async function main() {
    console.log("--- Starting Artifact Verification (Sanity Check) ---");

    // 1. Load Artifacts
    const buffers = {};
    const artifactStats = [];
    [ARTIFACTS.EXACT_XOR, ARTIFACTS.WILDCARD_XOR, ARTIFACTS.PSL_TRIE, ARTIFACTS.SHADOW_WHITELIST].forEach(name => {
        try {
            const { buffer, size } = loadArtifact(name);
            buffers[name.replace('.bin', '')] = buffer;
            artifactStats.push({ name, size, status: '✅ OK' });
        } catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });

    const reportLines = [];
    reportLines.push(`# 🕵️ Artifact Verification Report`);
    reportLines.push(`**Date:** ${new Date().toISOString()}`);

    let fatalFailures = 0;
    let warnings = 0;

    // --- 2. Critical Infrastructure Tests (FATAL) ---
    console.log(`\n[Test 1/3] Critical Infrastructure (Must Allow)`);
    reportLines.push(`\n## 🚨 Critical Infrastructure`);
    reportLines.push(`| Domain | Result | Status |`);
    reportLines.push(`| :--- | :--- | :--- |`);

    for (const domain of CRITICAL_DOMAINS) {
        const isBlocked = domainExists(domain, buffers);
        const pass = !isBlocked;
        if (!pass) fatalFailures++;

        const icon = pass ? '✅' : '❌';
        console.log(`  ${icon} ${domain}`);
        reportLines.push(`| \`${domain}\` | ${isBlocked ? 'Blocked' : 'Allowed'} | ${icon} |`);
    }

    // --- 3. Recommended Usability Tests (WARNING) ---
    console.log(`\n[Test 2/3] Recommended Services (Should Allow)`);
    reportLines.push(`\n## ⚠️ Recommended Services (Usability)`);
    reportLines.push(`| Domain | Result | Status |`);
    reportLines.push(`| :--- | :--- | :--- |`);

    for (const domain of RECOMMENDED_DOMAINS) {
        const isBlocked = domainExists(domain, buffers);
        const pass = !isBlocked;
        if (!pass) warnings++;

        const icon = pass ? '✅' : '⚠️';
        const logPrefix = pass ? '  ✅' : '  ⚠️ WARNING: Blocked';
        console.log(`${logPrefix} ${domain}`);
        reportLines.push(`| \`${domain}\` | ${isBlocked ? 'Blocked' : 'Allowed'} | ${icon} |`);
    }

    // --- 4. Known Bad Tests (FATAL) ---
    console.log(`\n[Test 3/3] Known Threats (Must Block)`);
    reportLines.push(`\n## 🛡️ Known Threats`);
    reportLines.push(`| Domain | Result | Status |`);
    reportLines.push(`| :--- | :--- | :--- |`);

    for (const test of BLOCK_TESTS) {
        const isBlocked = domainExists(test.domain, buffers);
        const pass = isBlocked === test.expectBlock;
        if (!pass) fatalFailures++;

        const icon = pass ? '✅' : '❌';
        console.log(`  ${icon} ${test.domain}`);
        reportLines.push(`| \`${test.domain}\` | ${isBlocked ? 'Blocked' : 'Allowed'} | ${icon} |`);
    }

    // Save Report
    if (!fs.existsSync(BUILD_DOCS_DIR)) fs.mkdirSync(BUILD_DOCS_DIR, { recursive: true });
    fs.writeFileSync(REPORT_FILE, reportLines.join('\n'));
    console.log(`\n📄 Report saved to: ${path.relative(process.cwd(), REPORT_FILE)}`);

    // Final Status
    if (warnings > 0) {
        console.log(`\n⚠️  WARNING: ${warnings} recommended domains were blocked. Review your source lists.`);
    }

    if (fatalFailures > 0) {
        console.error(`\n❌ FATAL: ${fatalFailures} critical tests failed. Build Aborted.`);
        process.exit(1);
    }

    console.log(`\n✅ Verification Complete.`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});