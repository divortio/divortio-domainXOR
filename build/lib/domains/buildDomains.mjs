/**
 * @file build/lib/domains/buildDomains.mjs
 * @description A module responsible for processing raw domain lists into structured sets.
 * It separates "Exact Matches" from "Wildcard Matches" and handles Punycode conversion.
 * @module ProcessDomains
 */

/**
 * Converts a domain string to its Punycode (ASCII) representation.
 * Handles Unicode (IDN) domains correctly.
 *
 * @param {string} domain - The raw domain string.
 * @returns {string|null} The normalized Punycode string, or null if invalid.
 */
function toPunycode(domain) {
    try {
        // URL API handles Punycode. Prepend protocol to parse as URL.
        return new URL(`http://${domain}`).hostname;
    } catch (e) {
        return null;
    }
}

/**
 * Processes a set of unique raw domains.
 * Separates them into exact matches and wildcard matches.
 * Applies PSL safety checks to prevent wildcarding TLDs.
 *
 * @param {Set<string>} rawDomains - The set of raw domain strings (may include *. prefix).
 * @param {Set<string>} psl - The Public Suffix List set.
 * @returns {{ exactMatches: Set<string>, wildcardMatches: Set<string> }}
 */
export function buildDomains(rawDomains, psl) {
    console.log(`- Processing and separating ${rawDomains.size} raw domains...`);

    const exactMatches = new Set();
    const wildcardMatches = new Set();

    for (const rawDomain of rawDomains) {
        // 1. Identify Wildcard
        const isWildcard = rawDomain.startsWith('*.');

        // 2. Extract Base Domain
        // If wildcard, strip "*.". If exact, use as is.
        const cleanRaw = isWildcard ? rawDomain.slice(2) : rawDomain;

        // 3. Normalize to Punycode
        const baseDomain = toPunycode(cleanRaw);
        if (!baseDomain) continue; // Skip invalid domains

        // 4. Classification & Safety
        if (isWildcard) {
            // Safety: Never allow wildcarding a Public Suffix (e.g. *.com)
            if (!psl.has(baseDomain)) {
                wildcardMatches.add(baseDomain);
            } else {
                // If it's a TLD, fall back to exact match (safer) or ignore?
                // Usually ignore, but exact match "com" is useless anyway.
                // We drop it to be safe.
            }
        } else {
            // Exact Match
            exactMatches.add(baseDomain);
        }
    }

    console.log(`  └─ Result:`);
    console.log(`     ├─ ${exactMatches.size} Exact Match domains`);
    console.log(`     └─ ${wildcardMatches.size} Wildcard domains`);

    return { exactMatches, wildcardMatches };
}