/**
 * @file build/lists/anudeep.mjs
 * @description Source configuration for AnudeepND's Blocklists.
 * Highly curated, manually tested lists with a focus on zero false positives.
 * @module Lists/Anudeep
 */

const BASE = 'https://raw.githubusercontent.com/anudeepND/blacklist/master';

export const ANUDEEP = {
    /**
     * Anudeep Adservers.
     * The main list. Blocks ads, trackers, and coin miners.
     * Very safe for general use.
     */
    ADSERVERS: `${BASE}/adservers.txt`,

    /**
     * Facebook Blocklist.
     * Aggressively blocks Facebook domains (including CDN/tracking).
     * WARNING: Will break Facebook, Instagram, and WhatsApp.
     */
    FACEBOOK: `${BASE}/facebook.txt`
};