/**
 * @file build/build.06.cleanup.mjs
 * @description Cleans up the local blocklist cache.
 * Run this to force a fresh network fetch on the next build.
 * Only targets the CACHE_DIR as requested.
 */

import fs from 'fs';
import { CACHE_DIR } from '../config.mjs';

console.log('🧹 Cleaning up blocklist cache...');

if (fs.existsSync(CACHE_DIR)) {
    try {
        fs.rmSync(CACHE_DIR, { recursive: true, force: true });
        console.log(`✅ Removed cache directory: ${CACHE_DIR}`);
    } catch (e) {
        console.error(`❌ Failed to remove ${CACHE_DIR}: ${e.message}`);
        process.exit(1);
    }
} else {
    console.log(`ℹ️  Cache directory does not exist: ${CACHE_DIR}`);
}

console.log('✨ Cleanup complete.');