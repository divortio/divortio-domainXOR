/**
 * @file build/lists/urlhaus.mjs
 * @description Source configuration for URLHaus by abuse.ch.
 * URLHaus is a project from abuse.ch with the goal of sharing malicious URLs
 * that are being used for malware distribution.
 * @module Lists/URLHaus
 */

/**
 * URLHaus Blocklist collection.
 * @constant
 * @type {{DEFAULT: string}}
 */
export const URLHAUS = {
    /**
     * The standard URLHaus hostfile.
     * Tracks active websites and domains currently distributing malware.
     * Updates frequently.
     */
    DEFAULT: 'https://urlhaus.abuse.ch/downloads/hostfile/'
};