/**
 * @file build/lists/oneHosts.mjs
 * @description Source configuration for 1Hosts.
 * A high-quality, configurable blocklist provider known for strictness.
 * @module Lists/1Hosts
 */

export const ONE_HOSTS = {
    /**
     * 1Hosts Lite.
     * Balanced protection. Blocks ads & trackers while minimizing breakage.
     */
    LITE: 'https://o0.pages.dev/Lite/hosts.txt',

    /**
     * 1Hosts Mini.
     * extremely lightweight, focusing only on the worst offenders.
     */
    MINI: 'https://o0.pages.dev/Mini/hosts.txt',

    /**
     * 1Hosts Pro.
     * Comprehensive. Targets ads/tracking/malware. High strictness.
     */
    PRO: 'https://o0.pages.dev/Pro/hosts.txt',

    /**
     * 1Hosts Xtra.
     * Maximum blocking. Includes everything in Pro plus more aggressive rules.
     * High risk of false positives (breaking legitimate sites).
     */
    XTRA: 'https://o0.pages.dev/Xtra/hosts.txt'
};