/**
 * @file /build/fetchPSL.mjs
 * @description A module for fetching and parsing the Public Suffix List (PSL).
 * @module FetchPSL
 */

import axios from 'axios';
import { startTimer, stopTimer, addListData } from '../stats/statsCollector.js';

const PSL_URL = 'https://publicsuffix.org/list/public_suffix_list.dat';

/**
 * Fetches and parses the Public Suffix List.
 *
 * @returns {Promise<Set<string>>} A promise that resolves to a Set containing all public suffixes.
 * @throws {Error} If the download or parsing fails.
 */
export async function fetchPSL() {
    const timerKey = `fetch-${PSL_URL}`;
    startTimer(timerKey);
    console.log(`- Fetching Public Suffix List from ${PSL_URL}...`);

    let response;
    try {
        response = await axios.get(PSL_URL, { timeout: 10000 });
    } catch (error) {
        throw new Error(`PSL download failed: ${error.message}`);
    }

    if (!response.data || response.data.length === 0) {
        throw new Error("PSL download failed: The file is empty.");
    }

    const pslEntries = new Set(
        response.data.split('\n')
            .map(line => line.trim())
            .filter(line => !line.startsWith('//') && line.length > 0)
    );

    if (pslEntries.size === 0) {
        throw new Error("PSL parsing failed: No valid entries found.");
    }

    // Report statistics to the collector
    addListData({
        url: PSL_URL,
        entryCount: pslEntries.size,
        sizeBytes: response.data.length,
        durationSeconds: stopTimer(timerKey),
        httpStatus: response.status,
    });

    console.log(`  └─ Success: Parsed ${pslEntries.size} PSL entries.`);
    return pslEntries;
}