/**
 * @file build/trie/buildPSLTrie.mjs
 * @description Builds the Public Suffix List Trie.
 * @module CreatePSLTrie
 */

import fs from 'fs';
import path from 'path';
import { buildTrie } from '../buildTrie.mjs';
import { startTimer, stopTimer, addBinaryData, formatBytes } from '../../stats/statsCollector.js';
import { BINS_DIR } from '../../../config.mjs';

const OUTPUT_FILE = path.join(BINS_DIR, 'pslTrie.bin');

/**
 *
 * @param pslData
 */
export function buildPSLTrie(pslData) {
    const timerKey = 'build-pslTrie';
    startTimer(timerKey);
    console.log('- Building PSL Trie...');

    if (pslData.size === 0) {
        throw new Error("Cannot build PSL Trie: PSL data is empty.");
    }

    /** * @param {string} item
     * @returns {number}
     */
    const flagSetter = (item) => 1;

    const trieBinary = buildTrie(Array.from(pslData), flagSetter);

    if (!fs.existsSync(BINS_DIR)) {
        fs.mkdirSync(BINS_DIR, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, trieBinary);

    addBinaryData({
        name: "Public Suffix List Trie",
        description: "A binary Trie of all public suffixes.",
        filename: 'pslTrie.bin',
        path: path.relative(process.cwd(), OUTPUT_FILE),
        entryCount: pslData.size,
        sizeBytes: trieBinary.length,
        sizeH: formatBytes(trieBinary.length),
        buildTimestamp: new Date().toISOString(),
        buildDurationSeconds: stopTimer(timerKey)
    });

    console.log(`  └─ Success: Wrote ${formatBytes(trieBinary.length)} to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}