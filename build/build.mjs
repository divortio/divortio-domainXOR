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
 * If any step fails (non-zero exit code), the orchestrator immediately triggers
 * the Cleanup step to remove intermediate data (preventing "poisoned" builds)
 * and then aborts the process.
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
 * The ordered list of build scripts to execute.
 * Order is critical as subsequent steps depend on the artifacts produced by previous steps.
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
    'steps/build.06.cleanup.mjs',  // 6. Cleanup Temporary Files (Cache & Data)
];

/**
 * Executes the build pipeline.
 * Iterates through `BUILD_STEPS`, spawning a synchronous Node.js process for each.
 *
 * @returns {void} This function does not return a value. It exits the process on failure.
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

        // Spawn node process inheriting stdio so colors and logs are preserved
        const result = spawnSync('node', [fullPath], {
            stdio: 'inherit',
            encoding: 'utf-8',
            cwd: process.cwd() // Ensure running from root
        });

        // Check for spawn errors (e.g., node not found)
        if (result.error) {
            console.error(`\n❌ FATAL: Failed to spawn process for ${stepName}`);
            console.error(result.error);
            process.exit(1);
        }

        // Check for script execution errors (non-zero exit code)
        if (result.status !== 0) {
            console.error(`\n❌ FATAL: ${stepName} failed with exit code ${result.status}`);

            // AUTO-RECOVERY: Run cleanup to reset poisoned state
            // We skip this if the failing step *was* the cleanup step to avoid loops.
            if (stepName !== 'build.06.cleanup.mjs') {
                console.error('   Running automated cleanup to reset build state...');
                const cleanupPath = path.join(__dirpath, 'steps/build.06.cleanup.mjs');
                spawnSync('node', [cleanupPath], {
                    stdio: 'inherit',
                    cwd: process.cwd()
                });
            }

            console.error('   Build pipeline aborted.');
            process.exit(1);
        }
    }

    const totalDuration = ((performance.now() - totalStart) / 1000).toFixed(2);

    console.log('\n==================================================');
    console.log(`   ✅ BUILD PIPELINE COMPLETE (${totalDuration}s)`);
    console.log('==================================================\n');
}

// Execute the pipeline
runPipeline();