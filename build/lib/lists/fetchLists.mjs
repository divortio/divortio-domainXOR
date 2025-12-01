/**
 * @file build/lib/lists/lib/fetchList.mjs
 * @description A module responsible for fetching and parsing domain blocklists.
 *
 * FIXED:
 * - Restored `meta` return object (fixes "rawCount of undefined" error).
 * - Preserves `*.` wildcard syntax (fixes "0 Wildcards" bug).
 * - Converts `||` to `*.`.
 * - Robust sanitization for URLs/Paths.
 *
 * @module FetchList
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { startTimer, stopTimer, addListData } from '../stats/statsCollector.js';
import { LIST_DIR } from '../../config.mjs';

function getCachePath(url) {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    return path.join(LIST_DIR, `${hash}.txt`);
}

function getContentHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Processes a single rule string.
 * @param {string} raw
 * @param {Set<string>} domainSet
 * @param {object} stats
 */
function processRule(raw, domainSet, stats) {
    let d = raw.trim();

    // 1. Telemetry & Fast Fail
    if (!d) return;
    if (d.startsWith('@@')) { stats.exceptions++; return; } // Whitelist rule
    if (d.startsWith('!') || d.startsWith('#')) return; // Comments
    if (d.includes('##') || d.includes('#@#')) { stats.cosmetic++; return; } // Cosmetic

    // 2. Normalize Adblock Syntax
    // "||example.com" -> "*.example.com" (Wildcard Intent)
    if (d.startsWith('||')) {
        d = '*.' + d.substring(2);
    }

    // Strip "Start" Anchor (|)
    if (d.startsWith('|')) {
        d = d.substring(1);
    }

    // Strip Adblock Modifiers (^, $, /)
    const separatorIndex = d.search(/[\^\$\/]/);
    if (separatorIndex !== -1) {
        d = d.substring(0, separatorIndex);
    }

    // Strip Trailing Pipe
    if (d.endsWith('|')) {
        d = d.substring(0, d.length - 1);
    }

    // 3. Sanitization
    d = d.toLowerCase();

    // Reject garbage characters (URL paths, ports, regex)
    if (/[ :\/\\?=%&{}<>\[\]]/.test(d)) {
        stats.urls++;
        return;
    }

    // 4. IP vs Domain Logic
    // Check for IP addresses - treat as Exact Match (strip wildcard if present)
    const cleanPart = d.startsWith('*.') ? d.slice(2) : d;
    const isIP = /^[\d.]+$/.test(cleanPart);

    if (isIP) {
        d = cleanPart; // Store as exact IP
        stats.ips++;
        // Allow valid IPs into the set
    } else {
        // Domain Validation
        if (!cleanPart.includes('.')) {
            stats.invalid++; // Reject "com" or "localhost"
            return;
        }
        if (d.startsWith('*.')) {
            stats.wildcards++;
        }
    }

    // 5. Final Add
    if (d.length > 0) {
        domainSet.add(d);
        stats.valid++;
    } else {
        stats.invalid++;
    }
}

export function parseBlocklistContent(textContent) {
    const stats = {
        total: 0,
        valid: 0,
        wildcards: 0,
        comments: 0,
        cosmetic: 0,
        exceptions: 0,
        urls: 0,
        ips: 0,
        invalid: 0,
        hash: ''
    };

    if (!textContent || textContent.trim().length === 0) return { domains: [], stats };

    // Calculate Content Hash
    stats.hash = getContentHash(textContent);

    const domains = new Set();
    const lines = textContent.split('\n');
    stats.total = lines.length;

    for (let line of lines) {
        line = line.trim();
        if (line.length === 0 || line.startsWith('#') || line.startsWith('!')) {
            stats.comments++;
            continue;
        }

        // 1. Hosts Format
        if (/^(127\.0\.0\.1|0\.0\.0\.0|::1)\s+/.test(line)) {
            const parts = line.split(/\s+/);
            if (parts[1]) {
                processRule(parts[1], domains, stats);
            } else {
                stats.invalid++;
            }
            continue;
        }

        // 2. Comma-Separated or Standard Rules
        if (line.includes(',')) {
            const parts = line.split(',');
            for (const part of parts) processRule(part.trim(), domains, stats);
        } else {
            processRule(line, domains, stats);
        }
    }

    return { domains: Array.from(domains), stats };
}

export async function fetchAndParseList(url) {
    const timerKey = `fetch-${url}`;
    startTimer(timerKey);

    const cachePath = getCachePath(url);
    let textContent;
    let fromCache = false;
    let status = 200;

    if (!fs.existsSync(LIST_DIR)) fs.mkdirSync(LIST_DIR, { recursive: true });

    try {
        if (fs.existsSync(cachePath)) {
            textContent = fs.readFileSync(cachePath, 'utf-8');
            fromCache = true;
        } else {
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
    const { domains, stats } = parseBlocklistContent(textContent);

    if (domains.length === 0) console.warn(`  ⚠️ Warning: No valid domains found in ${url}`);

    const duration = stopTimer(timerKey);

    // Create the META object required by build.00.lists.mjs
    const meta = {
        url: url,
        entryCount: domains.length,
        wildcardCount: stats.wildcards,
        rawCount: rawLines,
        sizeBytes: textContent.length,
        contentHash: stats.hash,
        durationSeconds: duration,
        httpStatus: fromCache ? 304 : status,
        details: {
            cosmetic: stats.cosmetic,
            exceptions: stats.exceptions,
            urls: stats.urls,
            ips: stats.ips,
            comments: stats.comments
        }
    };

    // Report to current process collector
    addListData(meta);

    // Return meta so the caller can access rawCount
    return { domains, meta };
}