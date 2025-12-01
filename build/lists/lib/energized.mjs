/**
 * @file build/lists/energized.mjs
 * @description Source configuration for Energized Protection.
 * A tiered suite of blocklists ranging from lightweight (Spark) to massive (Unified).
 * @module Lists/Energized
 */

const BASE = 'https://block.energized.pro';

export const ENERGIZED = {
    /**
     * Energized Spark.
     * The lightest pack. Blocks only the most intrusive ads and trackers.
     * Ideal for old hardware.
     */
    SPARK: `${BASE}/spark/formats/hosts.txt`,

    /**
     * Energized Blu.
     * Recommended for mobile devices. Good balance of blocking vs performance.
     */
    BLU: `${BASE}/blu/formats/hosts.txt`,

    /**
     * Energized Basic.
     * The standard recommendation for desktop/network-wide blocking.
     */
    BASIC: `${BASE}/basic/formats/hosts.txt`,

    /**
     * Energized Ultimate.
     * Flagship pack. Massive coverage. High chance of false positives.
     */
    ULTIMATE: `${BASE}/ultimate/formats/hosts.txt`,

    /**
     * Energized Unified.
     * The largest pack. Includes everything + Pornware.
     */
    UNIFIED: `${BASE}/unified/formats/hosts.txt`,

    /**
     * Energized Porn.
     * Dedicated pornography and adult content blocking.
     */
    PORN: `${BASE}/porn/formats/hosts.txt`
};