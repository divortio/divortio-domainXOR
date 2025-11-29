/**
 * @file lists.js
 * @description Configuration file for domain blocklist sources.
 *
 * This file exports an array of URLs that the build script (`build/build.01.run.mjs`)
 * will fetch, parse, and consolidate into the final binary filters.
 *
 * The build system supports these formats automatically:
 * 1. Standard Hosts File: "0.0.0.0 example.com" or "127.0.0.1 example.com"
 * 2. Adblock Plus Syntax: "||example.com^" (Converted to wildcard *.example.com)
 * 3. Plain Text: "example.com" (One domain per line)
 *
 * @module BlocklistSources
 */

/**
 * An array of URLs pointing to active domain blocklists.
 * @type {string[]}
 */
export const BLOCK_LIST_URLS = [
    // --- OISD (The Big Lists) ---
    // Extremely comprehensive aggregators. 'Big' includes everything in 'Small'.
    // 'NSFW' includes everything in 'NSFW-Small'.

    // OISD Big: The full, comprehensive list (Ads, Tracking, Malware, Phishing, etc.)
    // Contains ~4.3M+ domains.
    'https://big.oisd.nl',

    // OISD Small: A smaller, safer subset of Big.
     'https://small.oisd.nl',

    // OISD NSFW: Comprehensive blocking of adult content.
    'https://nsfw.oisd.nl',

    // OISD NSFW Small: A lighter subset of the NSFW list.
    'https://nsfw-small.oisd.nl',


    // --- Specialized Threat Intelligence (Malware, Phishing, C2) ---
    // These often update faster than aggregators and focus on high-danger targets.

    // URLHaus: Tracks active sites distributing malware.
    'https://urlhaus.abuse.ch/downloads/hostfile/',

    // Phishing Army: Dedicated list for blocking phishing campaigns.
    'https://phishing.army/download/phishing_army_blocklist_extended.txt',



    // --- Privacy, Tracking & Telemetry ---

    // EasyPrivacy: Specifically targets tracking scripts and telemetry.
    // format: Adblock Syntax (||domain^)
    'https://easylist.to/easylist/easyprivacy.txt',

    // NoTracking (The Great Wall): aggressive telemetry blocking (SmartTVs, Windows, etc.)
    'https://raw.githubusercontent.com/notracking/hosts-blocklists/master/hostnames.txt',


    // --- Aggressive / Pro Lists (Optional) ---
    // These are high-quality but may have higher false positives.
    // Uncomment if you want maximum blocking power.

    // 1Hosts (Pro): Very comprehensive, targets ads/tracking/malware.
    // More aggressive than OISD.
    'https://o0.pages.dev/Pro/hosts.txt',

    // HaGeZi Multi PRO++: Another massive aggregator (rivals OISD).
    // Excellent curation, but significant overlap with OISD.
    'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/domains/pro.plus.txt',


    // --- Standard / Backup Lists ---
    // These are good baselines. OISD likely includes them, but keeping them
    // ensures we have the latest version directly from the source.

    // StevenBlack Unified: The gold standard for a balanced hosts file.
    'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',

    // AdAway: Targeted specifically at mobile ad networks.
    'https://adaway.org/hosts.txt',

    // AdGuard DNS Filter: Professionally maintained, excellent wildcard support.
    'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt',
];