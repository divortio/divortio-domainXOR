/**
 * @file /build/index.mjs
 * @description The main entry point for the domain XOR filter build process.
 * This script orchestrates fetching, processing, and building all necessary binary artifacts.
 * @module BuildOrchestrator
 */

import { BLOCK_LIST_URLS } from '../block_lists.js';
import { fetchPSL } from './lists/fetchPSL.mjs';
import { fetchAllLists } from './lists/fetchLists.mjs';
import { processDomains } from './domains/processDomains.mjs';
import { createPslTrie } from './psl/createPslTrie.mjs';
import { createExactXOR } from './xor/createExactXOR.mjs';
import { createWildcardXOR } from './xor/createWildcardXOR.mjs';
import { startTimer, stopTimer, writeAllStats } from './stats/statsCollector.js';

/**
 * The main build function to orchestrate the entire process.
 * @returns {Promise<void>}
 */
async function main() {
    const overallTimerKey = 'total-build';
    startTimer(overallTimerKey);
    console.log("--- Starting Domain XOR Filter Build Process ---");

    // 1. Fetch all source data concurrently
    console.log("\n[Step 1/3] Fetching all source lists...");
    const [pslData, allBlocklists] = await Promise.all([
        fetchPSL(),
        fetchAllLists(BLOCK_LIST_URLS.filter(url => {
            try { new URL(url); return true; } catch (e) { return false; }
        })),
    ]);
    const totalRawDomains = allBlocklists.reduce((sum, list) => sum + list.length, 0);

    // 2. Process and separate the domains
    console.log("\n[Step 2/3] Processing and separating domains...");
    const uniqueDomains = new Set(allBlocklists.flat());
    const { exactMatches, wildcardMatches } = processDomains(uniqueDomains, pslData);
    const totalUniqueDomains = exactMatches.size + wildcardMatches.size;
    console.log(`Total unique, valid domains to process: ${totalUniqueDomains}`);

    // 3. Build all binary artifacts
    console.log("\n[Step 3/3] Building binary artifacts...");
    createPslTrie(pslData);
    createExactXOR(exactMatches);
    createWildcardXOR(wildcardMatches);

    // 4. Finalize and write stats
    const totalBuildDurationSeconds = stopTimer(overallTimerKey);
    writeAllStats({
        totalUniqueDomains: totalUniqueDomains,
        totalRawDomains: totalRawDomains,
        sourceListCount: BLOCK_LIST_URLS.length,
        totalBuildDurationSeconds: totalBuildDurationSeconds,
        buildTimestamp: new Date().toISOString(),
    });

    // Final Summary
    console.log("\n--- Build Complete! ---");
    console.log(`Total build time: ${totalBuildDurationSeconds} seconds.`);
    console.log("All binary artifacts and stats generated successfully.");
    console.log("-----------------------");
}

main().catch(error => {
    console.error(`\n--- BUILD FAILED ---`);
    console.error(error.message);
    process.exit(1);
});