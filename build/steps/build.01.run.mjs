/**
 * @file build/build.01.run.mjs
 * @description The main entry point/orchestrator for the Domain XOR Filter build process.
 * Updated to use caching and generate runtime metadata.
 * @module BuildOrchestrator
 */

import fs from 'fs';
import path from 'path';
import { BLOCK_LIST_URLS } from '../lists.js';
import { fetchPSL } from '../lib/lists/lib/fetchPSL.mjs';
import { fetchAllLists } from '../lib/lists/fetchLists.mjs';
import { buildDomains } from '../lib/domains/buildDomains.mjs';
import { buildPSLTrie } from '../lib/trie/lib/buildPSLTrie.mjs';
import { buildExactXOR } from '../lib/xor/lib/buildExactXOR.mjs';
import { buildWildcardXOR } from '../lib/xor/lib/buildWildcardXOR.mjs';
import { startTimer, stopTimer, writeAllStats } from '../lib/stats/statsCollector.js';
import { BUILD_DIR } from '../config.mjs';

async function main() {
    const overallTimerKey = 'total-build';
    startTimer(overallTimerKey);

    console.log("--- Starting Domain XOR Filter Build Process ---");

    // 1. Validation & Fetching
    console.log("\n[Step 1/4] Validating configuration and fetching sources...");
    if (!BLOCK_LIST_URLS || !Array.isArray(BLOCK_LIST_URLS)) {
        throw new Error("Build failed: BLOCK_LIST_URLS invalid.");
    }

    const validUrls = BLOCK_LIST_URLS.filter(url => {
        try { new URL(url); return true; } catch (e) { return false; }
    });

    if (validUrls.length === 0) {
        throw new Error("Build failed: No valid source URLs provided.");
    }

    // Fetching PSL and Blocklists (will use cache if available)
    const [pslData, allBlocklists] = await Promise.all([
        fetchPSL(),
        fetchAllLists(validUrls),
    ]);

    const totalRawDomains = allBlocklists.reduce((sum, list) => sum + list.length, 0);

    // 2. Processing
    console.log("\n[Step 2/4] Processing, deduplicating, and separating domains...");
    const uniqueDomains = new Set(allBlocklists.flat());
    const { exactMatches, wildcardMatches } = buildDomains(uniqueDomains, pslData);
    const totalUniqueDomains = exactMatches.size + wildcardMatches.size;

    // 3. Assembly
    console.log("\n[Step 3/4] Building binary artifacts...");
    buildPSLTrie(pslData);
    buildExactXOR(exactMatches);
    buildWildcardXOR(wildcardMatches);

    // 4. Finalization
    const totalBuildDurationSeconds = stopTimer(overallTimerKey);

    writeAllStats({
        totalUniqueDomains: totalUniqueDomains,
        totalRawDomains: totalRawDomains,
        sourceListCount: validUrls.length,
        totalBuildDurationSeconds: totalBuildDurationSeconds,
        buildTimestamp: new Date().toISOString(),
    });

    // Generate Runtime Metadata
    console.log("\n[Step 4.5] Generating runtime metadata...");

    let totalSizeBytes = 0;
    try {
        totalSizeBytes += fs.statSync(path.join(BUILD_DIR, 'bins', 'exactXOR.bin')).size;
        totalSizeBytes += fs.statSync(path.join(BUILD_DIR, 'bins', 'wildcardXOR.bin')).size;
        totalSizeBytes += fs.statSync(path.join(BUILD_DIR, 'bins', 'pslTrie.bin')).size;
    } catch (e) {
        console.warn("Warning: Could not calculate total size.", e.message);
    }

    const totalSizeFormatted = totalSizeBytes / 1024 / 1024 < 1
        ? (totalSizeBytes / 1024).toFixed(2) + ' KB'
        : (totalSizeBytes / 1024 / 1024).toFixed(2) + ' MB';

    const metaContent = `
/**
 * Auto-generated runtime metadata.
 * Do not edit manually.
 */
export const BUILD_META = {
    domainCount: "${new Intl.NumberFormat('en-US').format(totalUniqueDomains)}",
    buildDate: "${new Date().toISOString().split('T')[0]}",
    totalSize: "${totalSizeFormatted}"
};
`;

    if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true });
    fs.writeFileSync(path.join(BUILD_DIR, 'meta.mjs'), metaContent);

    console.log("\n--- Build Complete! ---");
}

main().catch(error => {
    console.error(`\n--- BUILD FAILED ---`);
    console.error(error.message);
    process.exit(1);
});