/**
 * @file /build/processDomains.mjs
 * @description A module to process and separate raw domain lists using the Public Suffix List.
 * @module ProcessDomains
 */

/**
 * Takes a raw, deduplicated list of domains and separates them into two sets
 * for exact and wildcard matching. It uses the Public Suffix List (PSL) to ensure
 * that wildcards are handled correctly and do not block entire TLDs.
 *
 * @param {Set<string>} uniqueDomains - A Set containing all unique domains from the source lists.
 * @param {Set<string>} psl - A Set containing the Public Suffix List entries.
 * @returns {{exactMatches: Set<string>, wildcardMatches: Set<string>}} An object containing two Sets of strings.
 */
export function processDomains(uniqueDomains, psl) {
    const exactMatches = new Set();
    const wildcardMatches = new Set();

    for (let domain of uniqueDomains) {
        if (domain.startsWith('*.')) {
            // This is a wildcard domain.
            const baseDomain = domain.substring(2);

            // Do not add if the base is itself a public suffix (e.g., block *.com).
            if (!psl.has(baseDomain)) {
                wildcardMatches.add(baseDomain);
            }
        } else {
            // This is an exact match domain.
            exactMatches.add(domain);
        }
    }

    console.log(`- Separated domains:`);
    console.log(`  ├─ ${exactMatches.size} exact match domains.`);
    console.log(`  └─ ${wildcardMatches.size} wildcard domains.`);
    return { exactMatches, wildcardMatches };
}