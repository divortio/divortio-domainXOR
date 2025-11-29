/**
 * @file build/config.mjs
 * @description Central configuration for build output paths.
 */

import path from 'path';

// The root directory for all build artifacts
export const BUILD_DIR = path.join(process.cwd(), 'src');

// Subdirectory for binary files (.bin) used by the runtime
export const BINS_DIR = path.join(BUILD_DIR, 'bins');

// Subdirectory for build statistics and receipts (.js)
export const STATS_DIR = path.join(BUILD_DIR, 'stats');

// Directory for caching raw blocklists to avoid re-fetching
export const CACHE_DIR = path.join(process.cwd(), '.cache', 'lists');