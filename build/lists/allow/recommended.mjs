/**
 * @file build/lists/allow/recommended.mjs
 * @description THE "HIGHLY RECOMMENDED" ALLOW LIST.
 *
 * These are high-traffic, popular domains (Big Tech, Content Providers, Banks).
 * Blocking these is technically valid (if you want an aggressive filter),
 * but it WILL break the user experience for 99% of users.
 *
 * FAILURE LEVEL: WARNING (Build proceeds, but logs alerts)
 *
 * @module AllowList/Recommended
 */

export const RECOMMENDED_DOMAINS = [
    // --- OS & Ecosystem Roots ---
    'google.com',
    'apple.com',
    'microsoft.com',
    'amazon.com',
    'android.com',
    'windows.com',
    'googleusercontent.com',
    // --- Content & Social ---
    'youtube.com',
    'netflix.com',
    'github.com',
    'wikipedia.org',
    'linkedin.com',
    'reddit.com',
    'facebook.com',
    'instagram.com',
    'twitter.com',
    'x.com',
    'tiktok.com',
    'twitch.tv',
    'spotify.com',
    'hulu.com',
    'disneyplus.com',

    // --- Infrastructure & CDN ---
    'cloudflare.com',
    'aws.amazon.com',
    'fastly.net',
    'akamai.com',
    'archive.org',

    // --- Common Utilities ---
    'zoom.us',
    'dropbox.com',
    'paypal.com',
    'stackoverflow.com',
    'duckduckgo.com',
    'proton.me'
];