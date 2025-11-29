/**
 * @file build/build.03.validate.mjs
 * @description Comprehensive Build Validation & Coverage Benchmark.
 * Fixed logic to correctly track Wildcards and Sources.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fetchAllLists } from '../lib/lists/fetchLists.mjs';
import { BLOCK_LIST_URLS } from '../lists.js';
import { buildDomains } from '../lib/domains/buildDomains.mjs';
import { domainExists } from '../../src/lookup.mjs';
import { BINS_DIR } from '../config.mjs';
import { fetchPSL } from '../lib/lists/lib/fetchPSL.mjs';

const REPORT_FILE = path.join(process.cwd(), 'src', 'built', 'BUILD_BLOCKED_REPORT.md');

function getSystemInfo() {
    const cpus = os.cpus();
    return {
        cpu: cpus[0] ? cpus[0].model : 'Unknown',
        cores: cpus.length,
        ram: (os.totalmem() / (1024 ** 3)).toFixed(2) + ' GB',
        os: `${os.platform()} ${os.release()}`,
        node: process.version
    };
}

function loadArtifacts() {
    try {
        const buffers = {};
        ['exactXOR.bin', 'wildcardXOR.bin', 'pslTrie.bin'].forEach(filename => {
            const raw = fs.readFileSync(path.join(BINS_DIR, filename));
            buffers[filename.replace('.bin', '')] = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length);
        });
        return buffers;
    } catch (e) {
        console.error(`❌ Failed to load artifacts: ${e.message}`);
        process.exit(1);
    }
}

async function verify() {
    console.log('\n==================================================');
    console.log('   🛡️  DOMAINXOR BUILD COVERAGE VALIDATION  🛡️');
    console.log('==================================================');

    const sys = getSystemInfo();
    const buffers = loadArtifacts();

    console.log('\n[1/4] Loading & Mapping Source Data (Cached)...');

    const [pslData, allBlocklists] = await Promise.all([
        fetchPSL(),
        fetchAllLists(BLOCK_LIST_URLS),
    ]);

    // Map processed domains to their source URLs
    const domainSourceMap = new Map();
    // Keep track of RAW domains for the final processing pass (to match builder logic)
    const rawDomains = new Set();

    allBlocklists.forEach((list, index) => {
        const sourceUrl = BLOCK_LIST_URLS[index];
        const uniqueInList = new Set(list);

        // Add RAW strings to the master set (Critical for correct Wildcard detection)
        list.forEach(d => rawDomains.add(d));

        // Process this list individually ONLY to build the source map
        const { exactMatches, wildcardMatches } = buildDomains(uniqueInList, pslData);

        const addToMap = (domain) => {
            if (!domainSourceMap.has(domain)) {
                domainSourceMap.set(domain, new Set());
            }
            domainSourceMap.get(domain).add(sourceUrl);
        };

        exactMatches.forEach(addToMap);
        wildcardMatches.forEach(addToMap);
    });

    console.log(`   ✓ Mapped ${new Intl.NumberFormat().format(domainSourceMap.size)} unique processed domains to sources.`);
    console.log(`   ✓ Loaded ${new Intl.NumberFormat().format(rawDomains.size)} raw unique domains.`);

    console.log('[2/4] Generating Test Cases...');
    const testCases = [];

    // Re-process the master set to generate the authoritative list of blocked domains
    // This exactly mirrors what the builder did.
    const { exactMatches, wildcardMatches } = buildDomains(rawDomains, pslData);

    for (const d of exactMatches) {
        testCases.push({ domain: d, type: 'Exact', sources: domainSourceMap.get(d) });
    }

    for (const d of wildcardMatches) {
        const synthetic = `test-${Math.floor(Math.random() * 1000)}.${d}`;
        testCases.push({ domain: synthetic, type: 'Wildcard (Sub)', base: d, sources: domainSourceMap.get(d) });
        testCases.push({ domain: d, type: 'Wildcard Base', sources: domainSourceMap.get(d) });
    }

    console.log(`   ✓ Generated ${new Intl.NumberFormat().format(testCases.length)} test cases.`);

    console.log('\n[3/4] Verifying Coverage...');
    domainExists('google.com', buffers);

    let passed = 0;
    let failed = 0;
    const failures = [];

    const start = performance.now();

    for (const test of testCases) {
        const isBlocked = domainExists(test.domain, buffers);
        if (isBlocked) {
            passed++;
        } else {
            failed++;
            if (failures.length < 50) failures.push(test);
        }
    }

    const end = performance.now();
    const durationSec = (end - start) / 1000;
    const opsPerSec = Math.floor(testCases.length / durationSec);

    console.log('\n[4/4] Generating Report...');
    const coverage = ((passed / testCases.length) * 100).toFixed(4);
    const statusIcon = failed === 0 ? '✅' : '⚠️';

    console.log('\n==================================================');
    console.log('   VALIDATION RESULTS');
    console.log('==================================================');
    console.log(`• Status:        ${statusIcon} ${failed === 0 ? 'PASSED' : 'PARTIAL FAILURE'}`);
    console.log(`• Coverage:      ${coverage}%`);
    console.log(`• Throughput:    ${new Intl.NumberFormat().format(opsPerSec)} lookups/sec`);

    if (failed > 0) {
        console.log(`\n❌ ${new Intl.NumberFormat().format(failed)} domains were NOT blocked.`);
        console.log('   Sample Failures:');
        failures.slice(0, 20).forEach(f => {
            const sources = f.sources ? Array.from(f.sources).join(', ') : 'Unknown';
            const displaySources = sources.length > 100 ? sources.substring(0, 97) + '...' : sources;
            console.log(`   - [${f.type}] ${f.domain}`);
            console.log(`     ↳ Source: ${displaySources}`);
        });
    } else {
        console.log(`\n✅ 100% Coverage Verified.`);
    }
    console.log('==================================================\n');

    const markdown = `# 🛡️ Build Coverage Report

**Date:** ${new Date().toISOString()}  
**Status:** ${statusIcon} ${failed === 0 ? 'Success' : 'Failed'}

## Summary
| Metric | Value |
| :--- | :--- |
| **Total Test Cases** | ${new Intl.NumberFormat().format(testCases.length)} |
| **Passed** | **${new Intl.NumberFormat().format(passed)}** |
| **Failed** | ${new Intl.NumberFormat().format(failed)} |
| **Coverage** | **${coverage}%** |
| **Throughput** | ${new Intl.NumberFormat().format(opsPerSec)} ops/sec |

${failed > 0 ? `
## ⚠️ Failure Analysis & Trace
**${failed}** domains failed validation.

### Sample Failures
| Type | Domain | Source List(s) |
| :--- | :--- | :--- |
${failures.map(f => `| ${f.type} | \`${f.domain}\` | ${f.sources ? Array.from(f.sources).join('<br>') : 'Unknown'} |`).join('\n')}
` : ''}

---
*Generated automatically by \`build/build.validate.mjs\`*
`;

    const reportDir = path.dirname(REPORT_FILE);
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(REPORT_FILE, markdown);
    console.log(`Report saved to: ${REPORT_FILE}`);

    if (failed > 0) process.exit(1);
}

verify();