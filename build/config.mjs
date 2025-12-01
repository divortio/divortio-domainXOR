/**
 * @file build/config.mjs
 * @description The Central Configuration and Control Plane.
 * @module BuildConfig
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filepath = fileURLToPath(import.meta.url);
const __dirpath = path.dirname(__filepath);
const __repopath = path.dirname(__dirpath);

// =============================================================================
// 1. PROJECT TOPOLOGY
// =============================================================================
export const SRC_DIR = path.join(__repopath, 'src');
export const LOOKUP_PATH = path.join(SRC_DIR, 'lookup.mjs');
export const BUILD_DIR = path.join(__repopath, 'dist');
export const PACKAGE_DIR = path.join(BUILD_DIR, 'domainXOR');
export const BINS_DIR = path.join(PACKAGE_DIR, 'bins');
export const STATS_DIR = path.join(PACKAGE_DIR, 'stats');
export const DOCS_DIR = path.join(BUILD_DIR, 'docs');
export const BUILD_DOCS_DIR = path.join(DOCS_DIR, 'build');
export const BENCH_DIR = path.join(DOCS_DIR, 'bench');
export const CACHE_DIR = path.join(BUILD_DIR, '.cache');
export const DATA_DIR = path.join(CACHE_DIR, 'data');
export const LIST_DIR = path.join(CACHE_DIR, 'lists');

// =============================================================================
// 2. BUILD TUNABLES
// =============================================================================
export const XOR_BIT_DEPTH = 16;
export const MAX_DOMAIN_PARTS = 128;
export const MAX_DOMAIN_LENGTH = 253;

// =============================================================================
// 3. ARTIFACT REGISTRY
// =============================================================================
export const ARTIFACTS = {
    EXACT_XOR: 'exactXOR.bin',
    WILDCARD_XOR: 'wildcardXOR.bin',
    PSL_TRIE: 'pslTrie.bin',
    SHADOW_WHITELIST: 'shadowWhitelist.bin'
};

export const DATA_FILES = {
    LISTS: 'lists.json',
    PSL: 'psl.json',
    TRANCO: 'tranco.json'
};

// =============================================================================
// 4. EXTERNAL RESOURCES
// =============================================================================
export const TRANCO_URL = 'https://tranco-list.eu/top-1m.csv.zip';
export const PSL_URL = 'https://publicsuffix.org/list/public_suffix_list.dat';