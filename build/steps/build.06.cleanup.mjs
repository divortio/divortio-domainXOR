/**
 * @file build/steps/build.06.cleanup.mjs
 * @description The Cleanup Utility.
 *
 * This module manages the lifecycle of build artifacts and cache files.
 *
 * Modes:
 * 1. **Default ("Post-Build Hygiene")**:
 * - Cleans: Intermediate Data Snapshots (`.cache/data`), Benchmark Temp Data.
 * - **KEEPS**: Final Binaries (`bins/`), Stats (`stats/`), Raw Downloads (`.cache/lists`).
 * - Use case: Running at the end of a successful build.
 *
 * 2. **Reset (`--reset`)**:
 * - Cleans: Binaries, Stats, Snapshots.
 * - **KEEPS**: Raw Downloads.
 * - Use case: Preparing for a fresh build or recovering from a logic failure.
 *
 * 3. **Nuke (`--nuke`)**:
 * - Cleans: EVERYTHING.
 * - Use case: "Factory Reset" to force re-downloading all sources.
 *
 * @module BuildCleanup
 */

import fs from 'fs';
import path from 'path';
import { CACHE_DIR, BENCH_DIR, DATA_DIR, LIST_DIR, BINS_DIR, STATS_DIR } from '../config.mjs';

/**
 * Recursively deletes a directory if it exists.
 * @param {string} dirPath
 * @param {string} label
 */
function removeDirectory(dirPath, label) {
    if (fs.existsSync(dirPath)) {
        try {
            fs.rmSync(dirPath, { recursive: true, force: true });
            console.log(`✅ Removed ${label}: ${path.relative(process.cwd(), dirPath)}`);
        } catch (e) {
            console.error(`❌ Failed to remove ${label}: ${e.message}`);
        }
    }
}

function cleanup() {
    const args = process.argv.slice(2);

    // Determine Mode
    const isNuke = args.includes('--nuke');
    const isReset = args.includes('--reset');
    const isBench = args.includes('--bench');

    // Calculate Scope based on flags
    // Nuke implies Reset. Reset implies Default cleaning.
    const cleanBinaries = isReset || isNuke;
    const cleanRawCache = isNuke;

    if (isBench) {
        console.log(`🧹 Running Cleanup (Mode: BENCHMARK)...`);
        removeDirectory(BENCH_DIR, 'Benchmark Reports');
        removeDirectory(path.join(CACHE_DIR, 'bench_data'), 'Benchmark Temp Data');
        return;
    }

    const modeLabel = isNuke ? 'NUKE (Wipe All)' : (isReset ? 'RESET (Binaries & Snapshots)' : 'POST-BUILD (Snapshots Only)');
    console.log(`🧹 Running Cleanup (Mode: ${modeLabel})...`);

    // 1. Intermediate Data (Always Cleaned)
    // These are JSON snapshots of the lists. They are cheap to regenerate from raw cache.
    removeDirectory(DATA_DIR, 'Compiled Data Snapshots');
    removeDirectory(path.join(CACHE_DIR, 'bench_data'), 'Benchmark Temp Data');

    // 2. Build Artifacts (Conditional)
    if (cleanBinaries) {
        removeDirectory(BINS_DIR, 'Binary Artifacts');
        removeDirectory(STATS_DIR, 'Build Statistics');
    } else {
        console.log(`ℹ️  Preserving Binaries & Stats (Use '--reset' to delete)`);
    }

    // 3. Raw Network Cache (Conditional)
    if (cleanRawCache) {
        removeDirectory(LIST_DIR, 'Raw Blocklist Cache');
        // Optional: Cleanup the parent cache dir if empty?
        // removeDirectory(CACHE_DIR, 'Cache Root');
    } else {
        console.log(`ℹ️  Preserving Raw Downloads (Use '--nuke' to delete)`);
    }

    console.log('✨ Cleanup complete.');
}

cleanup();