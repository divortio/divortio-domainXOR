/**
 * @file build/lib/lists/fetchTranco.mjs
 * @description Fetches and parses the Tranco Top 1 Million dataset.
 * Used for both Benchmarking and Shadow Whitelist generation.
 * @module FetchTranco
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { BENCH_DIR, TRANCO_URL } from '../../config.mjs';

const ZIP_PATH = path.join(BENCH_DIR, 'tranco_full.zip');
const CSV_PATH = path.join(BENCH_DIR, 'top-1m.csv');

async function downloadFile(url, dest) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(dest, Buffer.from(buffer));
}

/**
 * Fetches the Tranco list, caches it, and returns the array of domains.
 * @returns {Promise<string[]>}
 */
export async function fetchTranco() {
    if (!fs.existsSync(BENCH_DIR)) fs.mkdirSync(BENCH_DIR, { recursive: true });

    // Download if missing
    if (!fs.existsSync(ZIP_PATH)) {
        console.log(`    ⬇️ Downloading Tranco Top 1M from ${TRANCO_URL}...`);
        await downloadFile(TRANCO_URL, ZIP_PATH);
    }

    // Unzip if missing
    if (!fs.existsSync(CSV_PATH)) {
        console.log(`    📦 Extracting Tranco dataset...`);
        try {
            execSync(`unzip -p "${ZIP_PATH}" > "${CSV_PATH}"`);
        } catch (e) {
            // Fallback for environments without unzip (e.g. basic Windows CMD)
            // You might want to add a JS-based unzipper dependency if this is critical
            throw new Error(`Failed to unzip Tranco list. Ensure 'unzip' is in PATH. ${e.message}`);
        }
    }

    // Parse
    console.log(`    📄 Parsing Tranco CSV...`);
    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = content.split('\n');
    const domains = [];

    // Fast CSV parse (Rank,Domain)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length >= 2) {
            domains.push(parts[1]);
        }
    }

    return domains;
}