/**
 * @file block_lists.js
 * @description Configuration file for the domain blocklist sources.
 * This file exports the array of URLs that the build script will use to
 * compile the final `trie.bin` file.
 * @module BlocklistSources
 */

/**
 * An array of URLs pointing to domain blocklists.
 * Supported formats:
 * - Standard hosts file (e.g., 0.0.0.0 example.com)
 * - Simple list of domains (one per line)
 * - Adblock-style wildcards (e.g., ||example.com^)
 * @type {string[]}
 */
export const BLOCK_LIST_URLS = [
    'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
    'https://adaway.org/hosts.txt',
];