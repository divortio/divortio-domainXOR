/**
 * @file build/lists/adguard.mjs
 * @description Source configuration for AdGuard.
 * Professionally maintained filter lists widely used in the AdGuard software ecosystem.
 * @module Lists/AdGuard
 */

/**
 * AdGuard Blocklist collection.
 * @constant
 * @type {{DNS_FILTER: string}}
 */
export const AD_GUARD = {
    /**
     * AdGuard DNS Filter.
     * Optimized for DNS-level blocking, with excellent support for wildcards
     * and exclusion rules.
     */
    DNS_FILTER: 'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt'
};