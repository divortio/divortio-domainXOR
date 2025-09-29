/**
 * @file /build/products/createPslTrie.mjs
 * @description A dedicated script to build the binary Trie for the Public Suffix List.
 * @module CreatePSLTrie
 */

import fs from 'fs';
import path from 'path';
import { buildTrie } from '../xor/trieBuilder.mjs';
import { startTimer, stopTimer, addBinaryData, formatBytes } from '../stats/statsCollector.js';

const OUTPUT_DIR = path.join(process.cwd(), 'src', 'trie');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'pslTrie.bin');

/**
 * Builds and saves the pslTrie.bin file.
 * @param {Set<string>} pslData - A Set containing all public suffixes.
 */
export function createPslTrie(pslData) {
    const timerKey = 'build-pslTrie';
    startTimer(timerKey);
    console.log('- Building PSL Trie...');

    if (pslData.size === 0) {
        throw new Error("Cannot build PSL Trie: PSL data is empty.");
    }

    // A simple flag setter: every entry in the PSL is a valid "end" node.
    const flagSetter = (item) => 1;

    const trieBinary = buildTrie(Array.from(pslData), flagSetter);

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_FILE, trieBinary);

    // Report final statistics to the collector
    addBinaryData({
        name: "Public Suffix List Trie",
        description: "A binary Trie of all public suffixes, used to identify registrable domains.",
        filename: 'pslTrie.bin',
        path: path.relative(process.cwd(), OUTPUT_FILE),
        entryCount: pslData.size,
        sizeBytes: trieBinary.length,
        sizeH: formatBytes(trieBinary.length),
        buildTimestamp: new Date().toISOString(),
        buildDurationSeconds: stopTimer(timerKey),
    });

    console.log(`  └─ Success: Wrote ${formatBytes(trieBinary.length)} to ${OUTPUT_FILE}`);
}