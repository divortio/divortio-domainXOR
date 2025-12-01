/**
 * @file build/lists/oisd.mjs
 * @description Source configuration for OISD (Open Information Security Data).
 * OISD is a massive aggregator that compiles domain lists from dozens of sources,
 * optimizing for zero false positives in its standard lists.
 * @module Lists/OISD
 */

/**
 * OISD Blocklist collection.
 * @constant
 * @type {{BIG: string, SMALL: string, NSFW: string, NSFW_SMALL: string}}
 */
export const OISD = {
    /**
     * OISD Big: The full, comprehensive list containing ~4.3M+ domains.
     * Blocks ads, tracking, malware, phishing, and telemetry.
     */
    BIG: 'https://big.oisd.nl',

    /**
     * OISD Small: A highly curated, safer subset of Big designed for minimal breakage.
     */
    SMALL: 'https://small.oisd.nl',

    /**
     * OISD NSFW: Comprehensive blocking of adult content, gambling, and explicit sites.
     */
    NSFW: 'https://nsfw.oisd.nl',

    /**
     * OISD NSFW Small: A lighter subset of the NSFW list.
     */
    NSFW_SMALL: 'https://nsfw-small.oisd.nl'
};