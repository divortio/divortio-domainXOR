/**
 * @file build/lists/perflyst.mjs
 * @description Source configuration for Perflyst's SmartTV Blocklists.
 * Essential for privacy on modern Smart TVs (Samsung, LG, etc.) and streaming devices.
 * @module Lists/Perflyst
 */

const BASE = 'https://raw.githubusercontent.com/Perflyst/PiHoleBlocklist/master';

export const PERFLYST = {
    /**
     * Smart TV Blocklist.
     * Blocks ads, tracking, and telemetry on Samsung, LG, Sony, and other Smart TVs.
     */
    SMART_TV: `${BASE}/SmartTV.txt`,

    /**
     * Amazon FireTV Blocklist.
     * Specifically targets tracking and ads on FireTV / FireStick devices.
     */
    FIRE_TV: `${BASE}/AmazonFireTV.txt`,

    /**
     * Android Tracking.
     * Blocks tracking domains commonly used by Android OS and apps.
     */
    ANDROID_TRACKING: `${BASE}/android-tracking.txt`
};