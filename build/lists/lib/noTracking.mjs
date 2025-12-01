/**
 * @file build/lists/noTracking.mjs
 * @description Source configuration for NoTracking.
 * A list designed to block tracking metrics and telemetry from devices like
 * Smart TVs, Windows, Android, and Apple products.
 * @module Lists/NoTracking
 */

/**
 * NoTracking Blocklist collection.
 * @constant
 * @type {{DEFAULT: string}}
 */
export const NO_TRACKING = {
    /**
     * The master hostnames list.
     * Aggressive telemetry blocking.
     */
    DEFAULT: 'https://raw.githubusercontent.com/notracking/hosts-blocklists/master/hostnames.txt'
};