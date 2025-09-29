/**
 * @file /build/fetchLists.mjs
 * @description A module for managing the fetching of multiple domain blocklists.
 * @module FetchBlocklists
 */

import { fetchAndParseList } from './fetchList.mjs';

/**
 * Iterates through a list of URLs and fetches them sequentially. This function enforces
 * strict validation, halting the entire build if any single list fails to download or parse.
 *
 * @param {string[]} urls - An array of valid URLs to process.
 * @returns {Promise<string[][]>} A promise that resolves to an array of arrays, with each
 * inner array containing the domains from a successfully processed list.
 * @throws {Error} Bubbles up the error from `fetchAndParseList` on any failure.
 */
export async function fetchAllLists(urls) {
    const allLists = [];
    // We process lists sequentially to provide clear, actionable error messages.
    for (const url of urls) {
        try {
            const domains = await fetchAndParseList(url);
            allLists.push(domains);
        } catch (error) {
            // Re-throw the error with context to be caught by the main build script.
            throw new Error(`Fatal error for list ${url}: ${error.message}`);
        }
    }
    return allLists;
}