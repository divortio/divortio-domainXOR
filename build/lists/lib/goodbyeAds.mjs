/**
 * @file build/lists/goodbyeAds.mjs
 * @description Source configuration for GoodbyeAds.
 * Known for detailed app-specific blocking rules (Xiaomi, Samsung, YouTube).
 * @module Lists/GoodbyeAds
 */

const BASE = 'https://raw.githubusercontent.com/jerryn70/GoodbyeAds/master';

export const GOODBYE_ADS = {
    /**
     * GoodbyeAds Main.
     * Comprehensive blocking of ads and trackers.
     */
    MAIN: `${BASE}/Hosts/GoodbyeAds.txt`,

    /**
     * GoodbyeAds YouTube.
     * Attempts to block YouTube ad domains (Success varies by region/client).
     */
    YOUTUBE: `${BASE}/Extension/GoodbyeAds-YouTube-AdBlock.txt`,

    /**
     * GoodbyeAds Spotify.
     * Blocks ads in the Spotify free tier.
     */
    SPOTIFY: `${BASE}/Extension/GoodbyeAds-Spotify-AdBlock.txt`,

    /**
     * GoodbyeAds Xiaomi.
     * Blocks telemetry and ads in MIUI (Xiaomi phones).
     */
    XIAOMI: `${BASE}/Extension/GoodbyeAds-Xiaomi-Extension.txt`,

    /**
     * GoodbyeAds Samsung.
     * Blocks Samsung specific telemetry and ads.
     */
    SAMSUNG: `${BASE}/Extension/GoodbyeAds-Samsung-AdBlock.txt`
};