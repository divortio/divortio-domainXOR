/**
 * @file build/lists/stevenBlack.mjs
 * @description Source configuration for StevenBlack/hosts.
 * The "Gold Standard" unified hosts file. It consolidates several reputable sources
 * (AdAway, MVP, yoyo.org, etc.) into a single file with duplicates removed.
 *
 * We provide the "Unified" variants which include the base adware/malware blocking
 * plus specific extensions.
 *
 * @module Lists/StevenBlack
 */

const BASE_URL = 'https://raw.githubusercontent.com/StevenBlack/hosts/master';

/**
 * StevenBlack Blocklist collection.
 * @constant
 * @type {Object<string, string>}
 */
export const STEVEN_BLACK = {
    /**
     * Unified Base (Adware + Malware).
     * The standard, most popular version.
     */
    UNIFIED: `${BASE_URL}/hosts`,

    // --- Single Extensions ---
    FAKENEWS: `${BASE_URL}/alternates/fakenews/hosts`,
    GAMBLING: `${BASE_URL}/alternates/gambling/hosts`,
    PORN: `${BASE_URL}/alternates/porn/hosts`,
    SOCIAL: `${BASE_URL}/alternates/social/hosts`,

    // --- Double Extensions ---
    FAKENEWS_GAMBLING: `${BASE_URL}/alternates/fakenews-gambling/hosts`,
    FAKENEWS_PORN: `${BASE_URL}/alternates/fakenews-porn/hosts`,
    FAKENEWS_SOCIAL: `${BASE_URL}/alternates/fakenews-social/hosts`,
    GAMBLING_PORN: `${BASE_URL}/alternates/gambling-porn/hosts`,
    GAMBLING_SOCIAL: `${BASE_URL}/alternates/gambling-social/hosts`,
    PORN_SOCIAL: `${BASE_URL}/alternates/porn-social/hosts`,

    // --- Triple Extensions ---
    FAKENEWS_GAMBLING_PORN: `${BASE_URL}/alternates/fakenews-gambling-porn/hosts`,
    FAKENEWS_GAMBLING_SOCIAL: `${BASE_URL}/alternates/fakenews-gambling-social/hosts`,
    FAKENEWS_PORN_SOCIAL: `${BASE_URL}/alternates/fakenews-porn-social/hosts`,
    GAMBLING_PORN_SOCIAL: `${BASE_URL}/alternates/gambling-porn-social/hosts`,

    // --- Quadruple Extension (The "Kitchen Sink") ---
    ALL: `${BASE_URL}/alternates/fakenews-gambling-porn-social/hosts`
};