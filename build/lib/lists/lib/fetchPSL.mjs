/**
 * @file build/fetchPSL.mjs
 * @description A dedicated module for fetching and parsing the Public Suffix List (PSL)
 * from the official source. The PSL is critical for the build process to correctly
 * distinguish between a registrable domain (e.g., "google.com") and a Top Level Domain
 * (e.g., "co.uk"), ensuring wildcard rules do not accidentally block entire TLDs.
 * @module FetchPSL
 */

import { startTimer, stopTimer, addListData } from '../../stats/statsCollector.js';

// The official source URL for the Public Suffix List.
const PSL_URL = 'https://publicsuffix.org/list/public_suffix_list.dat';

/**
 * Fetches the Public Suffix List and parses it into a Set of unique suffixes.
 *
 * This function performs the following steps:
 * 1. Starts a performance timer.
 * 2. Fetches the raw DAT file using native fetch with a timeout.
 * 3. Validates the HTTP response and content length.
 * 4. Parses the file, stripping comments ("//") and empty lines.
 * 5. Reports execution statistics to the central collector.
 *
 * @returns {Promise<Set<string>>} A promise that resolves to a Set containing all unique public suffixes.
 * @throws {Error} If the download fails (network/timeout), the response is invalid, or the parsed set is empty.
 */
export async function fetchPSL() {
    const timerKey = `fetch-${PSL_URL}`;
    startTimer(timerKey);
    console.log(`- Fetching Public Suffix List from ${PSL_URL}...`);

    let response;
    try {
        // Use native fetch with a 10-second timeout.
        response = await fetch(PSL_URL, {
            signal: AbortSignal.timeout(10000)
        });
    } catch (error) {
        throw new Error(`PSL download failed: ${error.message}`);
    }

    // Check for HTTP errors (e.g., 404, 500).
    if (!response.ok) {
        throw new Error(`PSL download failed: Server responded with status ${response.status} (${response.statusText})`);
    }

    const textContent = await response.text();

    // Strict validation: Ensure we actually got data.
    if (!textContent || textContent.length === 0) {
        throw new Error("PSL download failed: The file is empty.");
    }

    // Parse the DAT file format.
    // The format consists of one rule per line. Lines starting with "//" are comments.
    const pslEntries = new Set(
        textContent.split('\n')
            .map(line => line.trim())
            // Filter out comments (//) and empty lines.
            .filter(line => !line.startsWith('//') && line.length > 0)
    );

    // Critical Validation: If the set is empty, the build cannot proceed safely.
    if (pslEntries.size === 0) {
        throw new Error("PSL parsing failed: No valid entries found in the downloaded file.");
    }

    // Report statistics to the central collector.
    // We adhere to the strict shape expected by addListData.
    addListData({
        url: PSL_URL,
        entryCount: pslEntries.size,
        sizeBytes: textContent.length,
        durationSeconds: stopTimer(timerKey),
        httpStatus: response.status,
    });

    console.log(`  └─ Success: Parsed ${pslEntries.size} PSL entries.`);
    return pslEntries;
}