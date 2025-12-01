/**
 * @file build/steps/build.00.lists.mjs
 * @description The Preparatory Build Step (Step 0).
 * Fetches blocklists and compiles them into JSON snapshots.
 *
 * FIXED:
 * - Restored `count` property to object return (Fixes NaN total).
 * - Validated stats logic.
 *
 * @module BuildLists
 */

import fs from 'fs';
import path from 'path';
import { BLOCK_LIST_URLS } from '../config.lists.mjs';
import { fetchPSL } from '../lib/lists/lib/fetchPSL.mjs';
import { fetchAndParseList } from '../lib/lists/lib/fetchList.mjs';
import { fetchTranco } from '../lib/lists/fetchTranco.mjs';
import { startTimer, stopTimer, writeAllStats } from '../lib/stats/statsCollector.js';
import { DATA_DIR, DATA_FILES } from '../config.mjs';

function saveArtifact(filename, data) {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data));
    console.log(`  └─ Saved artifact: ${path.relative(process.cwd(), filePath)}`);
}

async function main() {
    const timerKey = 'compile-lists';
    startTimer(timerKey);

    console.log("--- Starting List Compilation Step ---");

    // 1. Validation
    if (!BLOCK_LIST_URLS.length) throw new Error("No valid source URLs.");
    console.log(`  └─ Found ${BLOCK_LIST_URLS.length} configured sources.`);

    // 2. Resources
    console.log("\n[Step 2/3] Fetching Resources (PSL & Tranco)...");
    const [pslSet, trancoDomains] = await Promise.all([fetchPSL(), fetchTranco()]);
    saveArtifact(DATA_FILES.PSL, Array.from(pslSet));
    saveArtifact(DATA_FILES.TRANCO, trancoDomains);

    // 3. Blocklists
    console.log(`\n[Step 3/3] Fetching & Compiling Blocklists...`);

    const compiledLists = [];
    const promises = BLOCK_LIST_URLS.map(async (url) => {
        try {
            const { domains, meta } = await fetchAndParseList(url);

            // Console Logging
            // Note: dropped calculation might be slightly off if rawCount includes newlines that aren't rules
            const dropped = meta.rawCount - meta.entryCount - (meta.details?.comments || 0);
            const shortUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;

            console.log(`  🔹 ${shortUrl}`);
            console.log(`     ✅ Valid: ${new Intl.NumberFormat().format(meta.entryCount)} (Wildcards: ${new Intl.NumberFormat().format(meta.wildcardCount)})`);
            if (dropped > 0) {
                console.log(`     🗑️ Dropped: ${new Intl.NumberFormat().format(dropped)} (Cosmetic: ${meta.details.cosmetic}, URLs: ${meta.details.urls}, IPs: ${meta.details.ips})`);
            }

            // Save essential data + rich metadata
            return {
                url,
                domains,
                count: domains.length, // FIXED: This was missing!
                meta
            };
        } catch (e) {
            console.error(`❌ Failed: ${url} - ${e.message}`);
            throw e;
        }
    });

    const results = await Promise.all(promises);
    results.forEach(r => compiledLists.push(r));

    saveArtifact(DATA_FILES.LISTS, compiledLists);

    // Persist stats for later steps
    writeAllStats({});

    const totalDomains = compiledLists.reduce((sum, list) => sum + list.count, 0);
    const duration = stopTimer(timerKey);

    console.log('\n--- Compilation Complete ---');
    console.log(`• Total Sources: ${compiledLists.length}`);
    console.log(`• Total Domains: ${new Intl.NumberFormat().format(totalDomains)}`);
    console.log(`• Duration:      ${duration}s`);
}

main().catch(err => {
    console.error(`\n❌ Compilation Failed: ${err.message}`);
    process.exit(1);
});