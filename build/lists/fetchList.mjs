/**
 * @file /build/fetchList.mjs
 * @description A module for fetching and parsing a single domain blocklist from a URL.
 * It uses the native Node.js fetch API and reports metrics to the statsCollector.
 * @module FetchList
 */

import { startTimer, stopTimer, addListData } from '../stats/statsCollector.js';

/**
 * Fetches and parses a blocklist from a given URL.
 *
 * @param {string} url - The URL of the blocklist to fetch.
 * @returns {Promise<string[]>} A promise that resolves to an array of parsed domain strings.
 * @throws {Error} Throws an error if the download fails, the file is empty, or no valid domains are found.
 */
export async function fetchAndParseList(url) {
    const timerKey = `fetch-${url}`;
    startTimer(timerKey);
    console.log(`\n- Processing list: ${url}`);

    let response;
    try {
        // Use the native fetch API with a 10-second timeout.
        response = await fetch(url, {
            signal: AbortSignal.timeout(10000)
        });
    } catch (error) {
        // Catches network errors, DNS issues, or timeouts.
        throw new Error(`Download failed: ${error.message}`);
    }

    // Native fetch does not throw on bad HTTP status, so we must check `response.ok`.
    if (!response.ok) {
        throw new Error(`Download failed: Server responded with status ${response.status}`);
    }

    const textContent = await response.text();

    // Strict validation: ensure the downloaded file is not empty.
    if (!textContent || textContent.length === 0) {
        throw new Error("Download failed: The file is empty.");
    }

    const domains = textContent.split('\n')
        .map(line => line.trim())
        // Ignore comments and empty lines.
        .filter(line => !line.startsWith('#') && line.length > 0)
        .map(line => {
            const lowerLine = line.toLowerCase();
            // Handle standard hosts file format (e.g., "0.0.0.0 example.com").
            if (lowerLine.startsWith('0.0.0.0 ') || lowerLine.startsWith('127.0.0.1 ')) {
                return lowerLine.split(' ')[1];
            }
            // Handle Adblock-style wildcards (e.g., "||example.com^").
            if (lowerLine.startsWith('||') && lowerLine.endsWith('^')) {
                // Convert to the "*.example.com" format our Trie understands.
                return `*.${lowerLine.substring(2, lowerLine.length - 1)}`;
            }
            // Assume the line is a plain domain.
            return lowerLine;
        })
        // Basic validation that it looks like a domain and filter out nulls/empties.
        .filter(d => d && d.includes('.'));

    // Strict validation: ensure at least one valid domain was parsed from the content.
    if (domains.length === 0) {
        throw new Error("Parsing failed: No valid domains found in the list.");
    }

    // Report statistics for this specific list to the central collector.
    addListData({
        url: url,
        entryCount: domains.length,
        sizeBytes: textContent.length,
        durationSeconds: stopTimer(timerKey),
        httpStatus: response.status,
    });

    console.log(`  └─ Success: Parsed ${domains.length} domains.`);
    return domains;
}