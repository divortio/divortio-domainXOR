/**
 * @file build/lists/hagezi.mjs
 * @description Source configuration for HaGeZi DNS Blocklists.
 * A highly respected, comprehensive project offering tiered protection levels and
 * specialized filters for specific threats (Gambling, piracy, DoH, etc.).
 *
 * Source: https://github.com/hagezi/dns-blocklists
 * License: Creative Commons BY-NC-SA 4.0
 *
 * @module Lists/HaGeZi
 */

// We use the "domains" format which is essentially a hosts file without 0.0.0.0
const BASE = 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains';

export const HAGEZI = {
    // =========================================================================
    // 1. MULTI-PURPOSE AGGREGATES (Tiered Protection)
    // =========================================================================

    /**
     * HaGeZi Multi Light.
     * Basic protection against Ads, Tracking, and Malware.
     * Designed for zero false positives. WAF/Wife-Approved.
     */
    LIGHT: `${BASE}/light.txt`,

    /**
     * HaGeZi Multi Normal.
     * The recommended "Set and Forget" list.
     * Blocks Ads, Tracking, Metrics, and Malware with very low breakage risk.
     * NOTE: The file is named 'multi.txt', not 'normal.txt'.
     */
    NORMAL: `${BASE}/multi.txt`,

    /**
     * HaGeZi Multi Pro.
     * Extended protection. Blocks more trackers, telemetry, and annoyance sites.
     */
    PRO: `${BASE}/pro.txt`,

    /**
     * HaGeZi Multi Pro++.
     * Aggressive protection. Includes extensive subdomains and specific tracking services.
     * High coverage, minimal breakage.
     */
    PRO_PLUS: `${BASE}/pro.plus.txt`,

    /**
     * HaGeZi Multi Ultimate.
     * The "Sweeper". Blocks everything possible.
     * Strictly cleans the internet. High risk of false positives for casual browsing.
     */
    ULTIMATE: `${BASE}/ultimate.txt`,


    // =========================================================================
    // 2. THREAT INTELLIGENCE & SECURITY
    // =========================================================================

    /**
     * Threat Intelligence Feed (TIF).
     * Focuses purely on malicious domains (C2, malware, phishing, botnets).
     * No ads/tracking. Ideal for security layers.
     */
    TIF: `${BASE}/tif.txt`,

    /**
     * Fake Sites.
     * Blocks scam stores, fake tech support, and rip-off sites.
     */
    FAKE: `${BASE}/fake.txt`,

    /**
     * Dynamic DNS (DynDNS).
     * Blocks dynamic DNS providers often used by malware/C2/phishing.
     * Warning: May block legitimate personal servers.
     */
    DYNAMIC_DNS: `${BASE}/dyndns.txt`,

    /**
     * Badware Hoster.
     * Blocks hosting providers known for hosting malware/phishing content.
     */
    BADWARE_HOSTER: `${BASE}/hoster.txt`,

    /**
     * Most Abused TLDs.
     * Blocks entire Top Level Domains (e.g. .top, .gdn) with high abuse rates.
     * Very aggressive.
     */
    ABUSED_TLDS: `${BASE}/spam-tlds.txt`,

    /**
     * URL Shorteners.
     * Blocks link shorteners to prevent tracking and obfuscation.
     */
    URL_SHORTENER: `${BASE}/shortener.txt`,


    // =========================================================================
    // 3. CATEGORY BLOCKING (Content & Privacy)
    // =========================================================================

    /**
     * Gambling (Full).
     * Comprehensive blocking of gambling, casinos, and sports betting.
     */
    GAMBLING: `${BASE}/gambling.txt`,

    /**
     * Gambling (Mini).
     * Blocks only the most popular/prominent gambling sites.
     */
    GAMBLING_MINI: `${BASE}/gambling-mini.txt`,

    /**
     * Pop-Up Ads.
     * Specifically targets annoying pop-up/pop-under advertising domains.
     */
    POPUP_ADS: `${BASE}/popupads.txt`,

    /**
     * Anti-Piracy.
     * Blocks warez, torrent sites, and illegal streaming.
     */
    ANTI_PIRACY: `${BASE}/piracy.txt`,


    // =========================================================================
    // 4. TECHNICAL & DEVICE SPECIFIC
    // =========================================================================

    /**
     * DoH/VPN/Tor/Proxy Bypass.
     * Blocks domains used to bypass DNS filters (e.g. DNS-over-HTTPS providers).
     * Useful for parental control / enterprise enforcement.
     */
    DOH_VPN_PROXY: `${BASE}/doh-vpn-proxy-bypass.txt`,

    /**
     * Native Trackers (Amazon, Apple, Google, Huawei, Microsoft, Samsung, Xiaomi).
     * Blocks OS-level telemetry and tracking.
     * Warning: Will break some functionality (e.g. Smart TV features, Voice Assistants).
     */
    NATIVE_AMAZON: `${BASE}/native.amazon.txt`,
    NATIVE_APPLE: `${BASE}/native.apple.txt`,
    NATIVE_GOOGLE: `${BASE}/native.google.txt`,
    NATIVE_HUAWEI: `${BASE}/native.huawei.txt`,
    NATIVE_LG: `${BASE}/native.lgwebos.txt`,
    NATIVE_MICROSOFT: `${BASE}/native.microsoft.txt`,
    NATIVE_SAMSUNG: `${BASE}/native.samsung.txt`,
    NATIVE_TIKTOK: `${BASE}/native.tiktok.txt`,
    NATIVE_XIAOMI: `${BASE}/native.xiaomi.txt`,
};