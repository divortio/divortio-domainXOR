/**
 * @file build/lists/allow/critical.mjs
 * @description THE "NEVER EVER BLOCK" LIST.
 *
 * These domains are critical for network infrastructure, local resolution,
 * or RFC compliance. Blocking these indicates a fundamental flaw in the
 * filter generation logic or a corrupted source list.
 *
 * FAILURE LEVEL: FATAL (Build will fail)
 *
 * @module AllowList/Critical
 */

export const CRITICAL_DOMAINS = [
    // RFC 2606 Reserved Domains
    'example.com',
    'example.net',
    'example.org',
    'test',
    'invalid',
    'localhost',

    // Local Infrastructure
    'local',
    'localdomain',
    'router',
    'home',

    // Fundamental Connectivity Checks
    'captive.apple.com',
    'connectivitycheck.gstatic.com',
    'detectportal.firefox.com',
    'msftconnecttest.com',
    'networkcheck.kde.org'
];