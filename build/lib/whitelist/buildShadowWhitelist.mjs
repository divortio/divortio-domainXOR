/**
 * @file build/lib/whitelist/buildShadowWhitelist.mjs
 * @description The Shadow Whitelist Builder Module.
 *
 * UPDATED:
 * - **Structured Data**: Returns `{ domain, reason }` objects for better reporting.
 * - **Forced Rescue**: Prioritizes Critical/Recommended lists over blocklists.
 *
 * @module BuildShadowWhitelist
 */

import fs from 'fs';
import path from 'path';
import { domainExists } from '../../../src/lookup.mjs';
import { BINS_DIR, DATA_DIR, ARTIFACTS, DATA_FILES } from '../../config.mjs';
import { cyrb53 } from '../../lib/hash/lib/cyrb53.mjs';
import { startTimer, stopTimer, addBinaryData, formatBytes } from '../../lib/stats/statsCollector.js';

import { CRITICAL_DOMAINS } from '../../lists/allow/critical.mjs';
import { RECOMMENDED_DOMAINS } from '../../lists/allow/recommended.mjs';

const OUTPUT_FILE = path.join(BINS_DIR, ARTIFACTS.SHADOW_WHITELIST);

function loadArtifacts() {
    const buffers = {};
    const files = [ARTIFACTS.EXACT_XOR, ARTIFACTS.WILDCARD_XOR, ARTIFACTS.PSL_TRIE];

    files.forEach(filename => {
        const filePath = path.join(BINS_DIR, filename);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Artifact missing: ${filename}. Ensure 'build.01.run.mjs' has completed.`);
        }
        const raw = fs.readFileSync(filePath);
        const key = filename.replace('.bin', '');
        buffers[key] = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length);
    });

    return buffers;
}

function loadData() {
    const listsPath = path.join(DATA_DIR, DATA_FILES.LISTS);
    const trancoPath = path.join(DATA_DIR, DATA_FILES.TRANCO);

    if (!fs.existsSync(listsPath) || !fs.existsSync(trancoPath)) {
        throw new Error("Missing compiled data artifacts.");
    }

    const lists = JSON.parse(fs.readFileSync(listsPath, 'utf-8'));
    const tranco = JSON.parse(fs.readFileSync(trancoPath, 'utf-8'));

    const truthSet = new Set();
    lists.forEach(list => {
        list.domains.forEach(d => {
            truthSet.add(d);
            if (d.startsWith('*.')) truthSet.add(d.slice(2));
        });
    });

    return { truthSet, tranco };
}

export function buildShadowWhitelist() {
    const timerKey = 'build-whitelist';
    startTimer(timerKey);
    console.log('- Building Shadow Whitelist (Collision & Forced Rescue)...');

    const buffers = loadArtifacts();
    const { truthSet, tranco } = loadData();

    // Map<Hash, { domain, reason }>
    const rescueMap = new Map();

    const rescue = (domain, reason) => {
        const hash = cyrb53(domain);
        if (!rescueMap.has(hash.h1)) {
            rescueMap.set(hash.h1, { domain, reason });
        }
    };

    // 1. FORCED RESCUE (Overrides Blocklists)
    console.log(`  🔍 Checking Critical & Recommended lists...`);

    const priorityLists = [
        { name: 'Critical', list: CRITICAL_DOMAINS },
        { name: 'Recommended', list: RECOMMENDED_DOMAINS }
    ];

    priorityLists.forEach(({ name, list }) => {
        let count = 0;
        for (const domain of list) {
            if (domain.includes('://')) continue; // Skip invalid

            // If it's blocked by our filters, FORCE it open.
            if (domainExists(domain, buffers)) {
                rescue(domain, `Forced ${name}`);
                count++;
            }
        }
        if (count > 0) console.log(`     ✅ Force-rescued ${count} ${name} domains.`);
    });

    // 2. COLLISION RESCUE (Statistical False Positives)
    console.log(`  🔍 Scanning Tranco Top 1M for False Positives...`);
    let checks = 0;
    let fpCount = 0;

    for (const domain of tranco) {
        if (!domain) continue;

        const hash = cyrb53(domain);
        // If already rescued (by Forced Logic), skip
        if (rescueMap.has(hash.h1)) continue;

        const isBlocked = domainExists(domain, buffers);

        if (isBlocked) {
            // If it's in a blocklist, it's INTENTIONAL. Do not rescue.
            if (truthSet.has(domain)) continue;

            // If not in blocklist, it's a FALSE POSITIVE. Rescue it.
            rescueMap.set(hash.h1, { domain, reason: 'Collision (Top 1M)' });
            fpCount++;
        }
        checks++;
    }

    console.log(`     └─ Scanned ${new Intl.NumberFormat('en-US').format(checks)} domains.`);
    console.log(`     └─ Found ${fpCount} Statistical False Positives.`);

    // 3. Compile & Save
    // We only save the HASHES to the binary (runtime doesn't need reasons)
    const sortedHashes = new Uint32Array(Array.from(rescueMap.keys())).sort();

    const buffer = Buffer.from(sortedHashes.buffer);
    fs.writeFileSync(OUTPUT_FILE, buffer);

    // Return detailed objects for the report
    const rescuedItems = Array.from(rescueMap.values());

    addBinaryData({
        name: "Shadow Whitelist",
        description: "Sorted 32-bit hashes of Rescued Domains.",
        filename: ARTIFACTS.SHADOW_WHITELIST,
        path: path.relative(process.cwd(), OUTPUT_FILE),
        entryCount: rescuedItems.length,
        sizeBytes: buffer.length,
        sizeH: formatBytes(buffer.length),
        buildTimestamp: new Date().toISOString(),
        buildDurationSeconds: stopTimer(timerKey)
    });

    console.log(`  └─ Success: Wrote ${formatBytes(buffer.length)} to ${path.relative(process.cwd(), OUTPUT_FILE)}`);

    return {
        count: rescuedItems.length,
        sizeBytes: buffer.length,
        rescued: rescuedItems // Updated key name
    };
}