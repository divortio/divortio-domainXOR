/**
 * @file build/lists/adaway.mjs
 * @description Source configuration for AdAway.
 * A classic open-source blocker targeted specifically at mobile ad networks
 * and in-app advertising APIs.
 * @module Lists/AdAway
 */

/**
 * AdAway Blocklist collection.
 * @constant
 * @type {{DEFAULT: string}}
 */
export const AD_AWAY = {
    /**
     * The official AdAway hosts file.
     */
    DEFAULT: 'https://adaway.org/hosts.txt'
};