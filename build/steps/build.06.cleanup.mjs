/**
 * @file build/steps/build.06.cleanup.mjs
 * @description The Cleanup Step (Step 6).
 * This module handles the removal of temporary and stale artifacts to ensure a clean build environment.
 *
 * Modes:
 * 1. **Default ("Deep Clean")**: Removes EVERYTHING:
 * - Generated Binaries (`dist/domainXOR/bins`)
 * - Build Statistics (`dist/domainXOR/stats`)
 * - Compiled Data Snapshots (`dist/.cache/data`)
 * - **Raw Blocklist Cache** (`dist/.cache/lists`) - Forces fresh downloads.
 * - Benchmark Data (`dist/.cache/bench_data`)
 *
 * 2. **Smart Clean (`--smart` / `--fast`)**:
 * - Removes binaries and snapshots but **PRESERVES** raw blocklists to speed up iteration.
 *
 * 3. **Benchmark Clean (`--bench`)**:
 * - Removes only benchmark reports and temporary datasets.
 *
 * Usage:
 * - `node build/steps/build.06.cleanup.mjs` (Default: Wipe All)
 * - `node build/steps/build.06.cleanup.mjs --smart` (Keep Downloads)
 *
 * @module BuildCleanup
 */

import fs from 'fs';
import path from 'path';
import { CACHE_DIR, BENCH_DIR, DATA_DIR, LIST_DIR, BINS_DIR, STATS_DIR } from '../config.mjs';

/**
 * Recursively deletes a directory if it exists.
 * Logs the operation result to the console.
 *
 * @param {string} dirPath - The absolute path of the directory to remove.
 * @param {string} label - A human-readable label for the directory.
 * @returns {void}
 */
function removeDirectory(dirPath, label) {
    if (fs.existsSync(dirPath)) {
        try {
            fs.rmSync(dirPath, { recursive: true, force: true });
            console.log(`✅ Removed ${label}: ${path.relative(process.cwd(), dirPath)}`);
        } catch (e) {
            console.error(`❌ Failed to remove ${label}: ${e.message}`);
        }
    } else {
        console.log(`ℹ️  ${label} not found (clean).`);
    }
}

/**
 * Executes the cleanup logic.
 * @function main
 */
function main() {
    const args = process.argv.slice(2);

    // Determine Mode
    // Default is now 'deep' (Clean Everything) unless --smart/--fast is passed.
    const isSmart = args.includes('--smart') || args.includes('--fast');
    const isBench = args.includes('--bench');
    const mode = isBench ? 'BENCHMARK' : (isSmart ? 'SMART (Keep Cache)' : 'DEEP (Wipe All)');

    console.log(`🧹 Running Cleanup (Mode: ${mode})...`);

    if (isBench) {
        // Benchmark Mode: Only clean bench artifacts
        removeDirectory(BENCH_DIR, 'Benchmark Reports');
        const benchDataDir = path.join(CACHE_DIR, 'bench_data');
        removeDirectory(benchDataDir, 'Benchmark Temp Data');
        return;
    }

    // --- Universal Targets (Always Cleaned) ---
    // These are outputs or intermediate states that should always be reset.

    // 1. Binaries (*.bin)
    removeDirectory(BINS_DIR, 'Binary Artifacts');

    // 2. Build Stats (*.js)
    removeDirectory(STATS_DIR, 'Build Statistics');

    // 3. Intermediate Snapshots (lists.json, psl.json)
    removeDirectory(DATA_DIR, 'Compiled Data Snapshots');

    // --- Deep Clean Targets (Default) ---
    if (!isSmart) {
        // 4. Raw Network Cache
        // Removing this forces the next build to re-download all lists from the internet.
        removeDirectory(LIST_DIR, 'Raw Blocklist Cache');

        // 5. Benchmark Data
        // Might as well clean this up too in a deep clean
        const benchDataDir = path.join(CACHE_DIR, 'bench_data');
        removeDirectory(benchDataDir, 'Benchmark Temp Data');

        // Optional: Just wipe the whole .cache folder to be sure
        // removeDirectory(CACHE_DIR, 'Entire Build Cache');
    } else {
        console.log(`ℹ️  Preserving Raw Blocklist Cache (${path.relative(process.cwd(), LIST_DIR)})`);
        console.log(`   (Run without flags to wipe raw downloads)`);
    }

    console.log('✨ Cleanup complete.');
}

// Execute
main();