/**
 * @file build/lists/blocklistProject.mjs
 * @description Source configuration for The Block List Project.
 * Offers granular, category-based lists. Useful for parental control or specific policy enforcement.
 * @module Lists/BlocklistProject
 */

const BASE = 'https://raw.githubusercontent.com/blocklistproject/Lists/master';

export const BLOCKLIST_PROJECT = {
    /** General Ads */
    ADS: `${BASE}/ads.txt`,

    /** Tracking & Telemetry */
    TRACKING: `${BASE}/tracking.txt`,

    /** Malware & Spyware */
    MALWARE: `${BASE}/malware.txt`,

    /** Fraud & Phishing */
    FRAUD: `${BASE}/fraud.txt`,

    /** Gambling Sites */
    GAMBLING: `${BASE}/gambling.txt`,

    /** Drug related sites */
    DRUGS: `${BASE}/drugs.txt`,

    /** "Everything" - All lists combined */
    EVERYTHING: `${BASE}/everything.txt`
};