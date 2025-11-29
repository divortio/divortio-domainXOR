/**
 * @file build/lists/fetchList.mjs
 * @description A module responsible for fetching and parsing domain blocklists.
 * Implements robust parsing to exclude cosmetic rules and garbage.
 * @module FetchList
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { startTimer, stopTimer, addListData } from '../../stats/statsCollector.js';
import { CACHE_DIR } from '../../../config.mjs';

function getCachePath(url) {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    return path.join(CACHE_DIR, `${hash}.txt`);
}

export function parseBlocklistContent(textContent) {
    if (!textContent || textContent.trim().length === 0) return [];

    return textContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('!'))
        .map(line => {
            // 1. Strip inline comments
            let cleanLine = line.split('#')[0].trim();
            cleanLine = cleanLine.toLowerCase();

            // 2. Handle Hosts Format
            if (cleanLine.startsWith('0.0.0.0 ') || cleanLine.startsWith('127.0.0.1 ') || cleanLine.startsWith('::1 ')) {
                const parts = cleanLine.split(/\s+/);
                return parts[1] || '';
            }

            // 3. Handle Adblock Syntax
            if (cleanLine.startsWith('||') && cleanLine.endsWith('^')) {
                return `*.${cleanLine.substring(2, cleanLine.length - 1)}`;
            }

            return cleanLine;
        })
        // Final sanity check:
        // 1. Must have a dot
        // 2. Must NOT have spaces
        // 3. Must NOT have slashes (URL paths)
        // 4. Must NOT have commas (Cosmetic rule selectors)
        // 5. Must NOT have brackets or other CSS selector junk
        .filter(d =>
            d &&
            d.includes('.') &&
            !d.includes(' ') &&
            !d.includes('/') &&
            !d.includes(',') &&
            !d.includes('[') &&
            !d.includes(']')
        );
}

export async function fetchAndParseList(url) {
    const timerKey = `fetch-${url}`;
    startTimer(timerKey);

    const cachePath = getCachePath(url);
    let textContent;
    let fromCache = false;
    let status = 200;

    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    try {
        if (fs.existsSync(cachePath)) {
            console.log(`\n- Processing list (Cached): ${url}`);
            textContent = fs.readFileSync(cachePath, 'utf-8');
            fromCache = true;
        } else {
            console.log(`\n- Processing list (Network): ${url}`);
            const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
            if (!response.ok) throw new Error(`Status ${response.status}`);
            textContent = await response.text();
            fs.writeFileSync(cachePath, textContent);
            status = response.status;
        }
    } catch (error) {
        throw new Error(`Fetch failed for ${url}: ${error.message}`);
    }

    const rawLines = textContent.split('\n').length;
    const domains = parseBlocklistContent(textContent);

    if (domains.length === 0) {
        throw new Error("Parsing failed: No valid domains found.");
    }

    addListData({
        url: url,
        entryCount: domains.length,
        rawCount: rawLines,
        sizeBytes: textContent.length,
        durationSeconds: stopTimer(timerKey),
        httpStatus: fromCache ? 304 : status,
    });

    const sourceStr = fromCache ? "Cache" : "Network";
    console.log(`  └─ Success: Parsed ${domains.length} domains from ${rawLines} raw lines (${sourceStr}).`);
    return domains;
}