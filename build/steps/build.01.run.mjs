/**
 * @file build/steps/build.01.run.mjs
 * @description The Artifact Generation Step.
 * Restores statistics from previous steps and generates the binary artifacts.
 * @module BuildArtifacts
 */

import fs from 'fs';
import path from 'path';
import { buildDomains } from '../lib/domains/buildDomains.mjs';
import { buildPSLTrie } from '../lib/trie/lib/buildPSLTrie.mjs';
import { buildExactXOR } from '../lib/xor/lib/buildExactXOR.mjs';
import { buildWildcardXOR } from '../lib/xor/lib/buildWildcardXOR.mjs';
import { startTimer, stopTimer, writeAllStats, addListData } from '../lib/stats/statsCollector.js';
import { BUILD_DIR, DATA_DIR, BINS_DIR, DATA_FILES, ARTIFACTS } from '../config.mjs';

function loadData() {
    const pslPath = path.join(DATA_DIR, DATA_FILES.PSL);
    const listsPath = path.join(DATA_DIR, DATA_FILES.LISTS);

    if (!fs.existsSync(pslPath) || !fs.existsSync(listsPath)) {
        throw new Error("Missing compiled data artifacts. Please run 'build.00.lists.mjs' first.");
    }

    const pslData = new Set(JSON.parse(fs.readFileSync(pslPath, 'utf-8')));
    const listsData = JSON.parse(fs.readFileSync(listsPath, 'utf-8'));

    return { pslData, listsData };
}

async function main() {
    const overallTimerKey = 'total-build';
    startTimer(overallTimerKey);

    console.log("--- Starting Domain XOR Filter Build Process ---");

    // 1. Load Data & Restore Stats
    console.log("\n[Step 1/4] Loading compiled data & restoring stats...");
    const { pslData, listsData } = loadData();

    const allBlocklists = [];
    let totalRawDomains = 0;

    // Restore List Stats to the Collector so lists.js is generated correctly
    listsData.forEach(list => {
        if (list.meta) {
            addListData(list.meta);
            totalRawDomains += list.meta.rawCount;
        }
        allBlocklists.push(list.domains);
    });

    console.log(`  └─ Restored stats for ${listsData.length} lists.`);

    // 2. Processing
    console.log("\n[Step 2/4] Processing domains...");
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

    // Write Master Stats
    writeAllStats({
        totalUniqueDomains: totalUniqueDomains,
        totalRawDomains: totalRawDomains,
        exactCount: exactMatches.size,      // NEW
        wildcardCount: wildcardMatches.size,// NEW
        sourceListCount: listsData.length,
        totalBuildDurationSeconds: totalBuildDurationSeconds,
        buildTimestamp: new Date().toISOString(),
    });

    // Generate Runtime Metadata
    console.log("\n[Step 4.5] Generating runtime metadata...");
    // (Size calculation logic...)
    let totalSizeBytes = 0;
    try {
        [ARTIFACTS.EXACT_XOR, ARTIFACTS.WILDCARD_XOR, ARTIFACTS.PSL_TRIE].forEach(f => {
            const p = path.join(BINS_DIR, f);
            if (fs.existsSync(p)) totalSizeBytes += fs.statSync(p).size;
        });
    } catch(e) {}

    const totalSizeFormatted = (totalSizeBytes / 1024 / 1024).toFixed(2) + ' MB';

    const metaContent = `export const BUILD_META = {
    domainCount: "${new Intl.NumberFormat('en-US').format(totalUniqueDomains)}",
    buildDate: "${new Date().toISOString().split('T')[0]}",
    totalSize: "${totalSizeFormatted}"
};`;

    if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true });
    fs.writeFileSync(path.join(BUILD_DIR, 'meta.mjs'), metaContent);

    console.log("\n--- Build Complete! ---");
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});