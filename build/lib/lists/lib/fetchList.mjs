/**
 * @file build/lib/lists/lib/fetchList.mjs
 * @description A module responsible for fetching and parsing domain blocklists.
 *
 * UPDATES:
 * - Removed `SAFE_DOMAINS` check. We now allow lists to include whatever they want.
 * - Safety is now enforced via alerts in the Verification step, not by silently dropping rules.
 *
 * @module FetchList
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { startTimer, stopTimer, addListData } from '../../stats/statsCollector.js';
import { LIST_DIR } from '../../../config.mjs';

function getCachePath(url) {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    return path.join(LIST_DIR, `${hash}.txt`);
}

function getContentHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
}

function processRule(raw, domainSet, stats) {
    let d = raw.trim();

    if (!d) return;
    if (d.startsWith('@@')) { stats.exceptions++; return; }
    if (d.startsWith('!') || d.startsWith('#')) return;
    if (d.includes('##') || d.includes('#@#')) { stats.cosmetic++; return; }

    // Normalize
    if (d.startsWith('||')) d = '*.' + d.substring(2);
    if (d.startsWith('|')) d = d.substring(1);
    const separatorIndex = d.search(/[\^\$\/]/);
    if (separatorIndex !== -1) d = d.substring(0, separatorIndex);
    if (d.endsWith('|')) d = d.substring(0, d.length - 1);

    d = d.toLowerCase();

    if (/[ :\/\\?=%&{}<>\[\]]/.test(d)) {
        stats.urls++;
        return;
    }

    const isWildcard = d.startsWith('*.');
    const cleanPart = isWildcard ? d.slice(2) : d;

    if (/^[\d.]+$/.test(cleanPart)) {
        d = cleanPart;
        stats.ips++;
    } else {
        if (!cleanPart.includes('.')) {
            stats.invalid++;
            return;
        }
        if (!isWildcard) {
            d = '*.' + d;
            stats.wildcards++;
        } else {
            stats.wildcards++;
        }
    }

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

        if (/^(127\.0\.0\.1|0\.0\.0\.0|::1)\s+/.test(line)) {
            const parts = line.split(/\s+/);
            if (parts[1]) processRule(parts[1], domains, stats);
            else stats.invalid++;
            continue;
        }

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

    addListData(meta);

    return { domains, meta };
}