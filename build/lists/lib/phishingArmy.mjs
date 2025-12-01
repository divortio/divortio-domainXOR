/**
 * @file build/lists/phishingArmy.mjs
 * @description Source configuration for Phishing Army.
 * A community-driven project that provides a dedicated blocklist for phishing campaigns.
 * @module Lists/PhishingArmy
 */

/**
 * Phishing Army Blocklist collection.
 * @constant
 * @type {{EXTENDED: string, BLOCKLIST: string}}
 */
export const PHISHING_ARMY = {
    /**
     * Phishing Army Extended List.
     * Contains domains and subdomains. Recommended for better coverage.
     */
    EXTENDED: 'https://phishing.army/download/phishing_army_blocklist_extended.txt',

    /**
     * Phishing Army Standard Blocklist.
     * A smaller subset, often used if the extended list is too aggressive.
     */
    BLOCKLIST: 'https://phishing.army/download/phishing_army_blocklist.txt'
};