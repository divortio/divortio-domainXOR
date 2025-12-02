/**
 * @file build/build.mjs
 * @description The Master Build Orchestrator.
 * This script executes the entire build pipeline sequentially as separate child processes.
 *
 * Pipeline Stages:
 * 1. **Preparation**: Fetch sources and compile data snapshots (`build.00`).
 * 2. **Construction**: Generate binary filters and the rescue whitelist (`build.01`, `build.01a`).
 * 3. **Quality Assurance**: Verify integrity and validate coverage (`build.02`, `build.03`).
 * 4. **Reporting**: Generate summary and performance benchmarks (`build.04`, `build.05`).
 * 5. **Cleanup**: Remove temporary artifacts (`build.06`).
 *
 * **Failure Handling**:
 * If any step fails, we trigger a "Reset" cleanup (wipes binaries/snapshots, keeps raw downloads).
 *
 * **Success Handling**:
 * If successful, we trigger a "Smart" cleanup (wipes snapshots, keeps binaries & raw downloads).
 *
 * @module BuildMaster
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * The absolute path of the current file (`build/build.mjs`).
 * @constant {string}
 */
const __filepath = fileURLToPath(import.meta.url);

/**
 * The directory containing the build steps.
 * @constant {string}
 */
const __dirpath = path.dirname(__filepath);

/**
 * The absolute path to the cleanup script.
 * @constant {string}
 */
const CLEANUP_SCRIPT = path.join(__dirpath, 'steps/build.06.cleanup.mjs');

/**
 * The ordered list of build scripts to execute.
 * NOTE: Cleanup is NOT in this list; it is handled explicitly at the end or on error.
 * @constant {string[]}
 */
const BUILD_STEPS = [
    'steps/build.00.lists.mjs',    // 0. Fetch & Compile Lists (Create JSON snapshots)
    'steps/build.01.run.mjs',      // 1. Build Artifacts (Exact/Wildcard XOR + Trie)
    'steps/build.01a.whitelist.mjs', // 1a. Build Shadow Whitelist (Rescue collisions)
    'steps/build.02.verify.mjs',   // 2. Verify Integrity (Ensure 100% block rate)
    'steps/build.03.validate.mjs', // 3. Validate Coverage (Source mapping check)
    'steps/build.04.report.mjs',   // 4. Generate Markdown Report
    'steps/build.05.bench.mjs',    // 5. Run Performance Benchmark (Tranco 1M)
];

/**
 * Helper to run the cleanup script with specific flags.
 * @param {string[]} flags - Arguments to pass (e.g., ['--reset'] or ['--smart']).
 */
function runCleanup(flags) {
    console.log(`\n🧹 Triggering Cleanup (${flags.join(' ')})...`);
    const result = spawnSync('node', [CLEANUP_SCRIPT, ...flags], {
        stdio: 'inherit',
        encoding: 'utf-8',
        cwd: process.cwd()
    });

    if (result.status !== 0) {
        console.error('⚠️ Cleanup script failed to run correctly.');
    }
}

/**
 * Executes the build pipeline.
 * @returns {void}
 */
function runPipeline() {
    console.log('\n==================================================');
    console.log('   🏗️  STARTING MASTER BUILD PIPELINE');
    console.log('==================================================');

    const totalStart = performance.now();

    for (const stepFile of BUILD_STEPS) {
        const stepName = path.basename(stepFile);
        const fullPath = path.join(__dirpath, stepFile);

        console.log(`\n🔹 Executing Step: ${stepName}`);

        const result = spawnSync('node', [fullPath], {
            stdio: 'inherit',
            encoding: 'utf-8',
            cwd: process.cwd()
        });

        // Handle Spawn Error
        if (result.error) {
            console.error(`\n❌ FATAL: Failed to spawn process for ${stepName}`);
            console.error(result.error);
            process.exit(1);
        }

        // Handle Script Failure
        if (result.status !== 0) {
            console.error(`\n❌ FATAL: ${stepName} failed with exit code ${result.status}`);

            // FAILURE MODE: RESET
            // We want to delete the potentially corrupted binaries and snapshots so the next run is clean.
            // We do NOT want to delete the raw downloads (too slow to re-fetch).
            runCleanup(['--reset']);

            console.error('   Build pipeline aborted.');
            process.exit(1);
        }
    }

    const totalDuration = ((performance.now() - totalStart) / 1000).toFixed(2);

    console.log('\n==================================================');
    console.log(`   ✅ BUILD PIPELINE COMPLETE (${totalDuration}s)`);
    console.log('==================================================');

    // SUCCESS MODE: SMART CLEAN
    // We want to delete the intermediate JSON snapshots (to save space/confusion).
    // We MUST PRESERVE the binaries we just built and the raw downloads.
    runCleanup(['--smart']);
}

// Execute the pipeline
runPipeline();