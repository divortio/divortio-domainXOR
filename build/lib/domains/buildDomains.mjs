/**
 * @file build/buildDomains.mjs
 * @description A module responsible for processing raw domain lists into structured sets
 * for the build process. It handles:
 * 1. Normalization of domains to Punycode (ASCII).
 * 2. Deduplication of domains.
 * 3. Separation of "Exact Matches" from "Wildcard Matches".
 * 4. Validation against the Public Suffix List (PSL) to prevent blocking entire TLDs.
 * @module ProcessDomains
 */

/**
 * Converts a domain string to its Punycode (ASCII) representation.
 * This is critical because browsers and the Cloudflare Runtime operate on Punycode
 * for internationalized domain names (IDN). If we build our filter with Unicode
 * strings (e.g., "bücher.com"), lookups for the actual network request
 * (e.g., "xn--bcher-kva.com") would fail.
 *
 * @param {string} domain - The raw domain string (potentially Unicode).
 * @returns {string|null} The normalized Punycode string, or null if invalid.
 */
function toPunycode(domain) {
    try {
        // The URL API automatically handles Punycode conversion for hostnames.
        // We prepend 'http://' to ensure it parses as a valid URL.
        return new URL(`http://${domain}`).hostname;
    } catch (e) {
        // If the domain is malformed and cannot be parsed, return null to skip it.
        return null;
    }
}

/**
 * Processes a set of unique, raw domains and separates them into exact matches
 * and wildcard matches, adhering to PSL safety rules.
 *
 * @param {Set<string>} uniqueDomains - A Set containing all unique, raw domains collected from source lists.
 * @param {Set<string>} psl - A Set containing the Public Suffix List entries (e.g., "com", "co.uk").
 * @returns {{ exactMatches: Set<string>, wildcardMatches: Set<string> }} An object containing two Sets of normalized domains.
 */
export function buildDomains(uniqueDomains, psl) {
    const exactMatches = new Set();
    const wildcardMatches = new Set();

    console.log(`- Processing and separating ${uniqueDomains.size} raw domains...`);

    for (let rawDomain of uniqueDomains) {
        // 1. Input Sanitization & Normalization
        // Convert to Punycode to ensure matching works correctly in the runtime.
        let domain = toPunycode(rawDomain);

        if (!domain) continue;

        // 2. Wildcard Detection
        // Our supported wildcard format is "*.domain.com".
        // The raw input might be "domain.com" (implicit exact) or "*.domain.com" (explicit wildcard).
        // Note: fetchList.mjs has already normalized Adblock syntax (||) to start with (*.).
        if (rawDomain.startsWith('*.')) {
            // This is a wildcard rule.
            // The 'domain' variable currently holds the Punycode version of "domain.com"
            // (toPunycode strips the *.), which is exactly what we want to check against the PSL.

            // Note: Depending on how `toPunycode` handles `*.`, we might need to be careful.
            // `new URL('http://*.example.com').hostname` is often invalid or `%2A.example.com`.
            // Safer approach: strip the `*.` *before* Punycode conversion.

            const rawBase = rawDomain.substring(2); // Remove "*."
            const baseDomain = toPunycode(rawBase);

            if (!baseDomain) continue;

            // 3. PSL Safety Check
            // We must NOT add a wildcard for a public suffix.
            // Example: Blocking "*.com" or "*.co.uk" would break the internet.
            // We check if the base domain exists in the PSL.
            if (!psl.has(baseDomain)) {
                wildcardMatches.add(baseDomain);
            } else {
                // Optional: We could log rejected wildcards here for debugging.
                // console.debug(`Ignored unsafe wildcard: *.${baseDomain}`);
            }
        } else {
            // This is an exact match domain.
            // `domain` is already the Punycode version.
            exactMatches.add(domain);
        }
    }

    console.log(`  └─ Result:`);
    console.log(`     ├─ ${exactMatches.size} Exact Match domains`);
    console.log(`     └─ ${wildcardMatches.size} Wildcard domains`);

    return { exactMatches, wildcardMatches };
}