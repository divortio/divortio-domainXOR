/**
 * @file build/lists/easyList.mjs
 * @description Source configuration for EasyList, EasyPrivacy, and regional variants.
 * These are the primary filter lists used by most adblockers (uBlock Origin, Adblock Plus).
 *
 * NOTE: The build system primarily parses domain-based rules (`||example.com^`).
 * Cosmetic filters (##.ad-banner) in these lists are largely ignored by the current
 * parsing logic, but these URLs are provided for completeness.
 *
 * @module Lists/EasyList
 */

export const EASY_LIST = {
    // --- Core Lists ---
    /**
     * EasyList.
     * The primary ad-blocking list. Removes most adverts from international webpages.
     */
    ADS: 'https://easylist.to/easylist/easylist.txt',

    /**
     * EasyPrivacy.
     * Specifically targets tracking scripts, data collectors, and telemetry.
     */
    PRIVACY: 'https://easylist.to/easylist/easyprivacy.txt',

    /**
     * Fanboy's Annoyance List.
     * Blocks Social Media content, in-page pop-ups, and other annoyances.
     */
    ANNOYANCE: 'https://easylist.to/easylist/fanboy-annoyance.txt',

    /**
     * Fanboy's Social Blocking List.
     * Solely removes Social Media widgets (Like buttons, feeds).
     */
    SOCIAL: 'https://easylist.to/easylist/fanboy-social.txt',

    /**
     * Adblock Warning Removal List.
     * Removes obtrusive messages targeting users who use an adblocker.
     */
    ANTI_ADBLOCK: 'https://easylist-downloads.adblockplus.org/antiadblockfilters.txt',


    // --- Variants (Specialized) ---

    /**
     * EasyList without element hiding.
     * Only contains blocking filters, no cosmetic rules.
     */
    ADS_NO_ELEMENT_HIDING: 'https://easylist-downloads.adblockplus.org/easylist_noelemhide.txt',

    /**
     * EasyList without rules for adult sites.
     */
    ADS_NO_ADULT: 'https://easylist-downloads.adblockplus.org/easylist_noadult.txt',

    /**
     * EasyPrivacy without rules for international domains.
     */
    PRIVACY_NO_INTL: 'https://easylist-downloads.adblockplus.org/easyprivacy_nointernational.txt',


    // --- Regional / Language Specific Lists ---

    /** ABPindo (Indonesian) */
    INDONESIAN: 'https://raw.githubusercontent.com/heradhis/indonesianadblockrules/master/subscriptions/abpindo.txt',

    /** ABPVN List (Vietnamese) */
    VIETNAMESE: 'https://abpvn.com/filter/abpvn-IPl6HE.txt',

    /** Bulgarian List */
    BULGARIAN: 'http://stanev.org/abp/adblock_bg.txt',

    /** EasyList China (Chinese) */
    CHINESE: 'https://easylist-downloads.adblockplus.org/easylistchina.txt',

    /** EasyList Czech and Slovak */
    CZECH_SLOVAK: 'https://raw.githubusercontent.com/tomasko126/easylistczechandslovak/master/filters.txt',

    /** EasyList Dutch */
    DUTCH: 'https://easylist-downloads.adblockplus.org/easylistdutch.txt',

    /** EasyList Germany */
    GERMAN: 'https://easylist.to/easylistgermany/easylistgermany.txt',

    /** EasyList Hebrew */
    HEBREW: 'https://raw.githubusercontent.com/easylist/EasyListHebrew/master/EasyListHebrew.txt',

    /** IndianList (Multiple Indian Languages) */
    INDIAN: 'https://easylist-downloads.adblockplus.org/indianlist.txt',

    /** EasyList Italy */
    ITALIAN: 'https://easylist-downloads.adblockplus.org/easylistitaly.txt',

    /** KoreanList */
    KOREAN: 'https://easylist-downloads.adblockplus.org/koreanlist.txt',

    /** EasyList Lithuania */
    LITHUANIAN: 'https://raw.githubusercontent.com/EasyList-Lithuania/easylist_lithuania/master/easylistlithuania.txt',

    /** Latvian List */
    LATVIAN: 'https://raw.githubusercontent.com/Latvian-List/adblock-latvian/master/lists/latvian-list.txt',

    /** Liste AR (Arabic) */
    ARABIC: 'https://easylist-downloads.adblockplus.org/Liste_AR.txt',

    /** Liste FR (French) */
    FRENCH: 'https://easylist-downloads.adblockplus.org/liste_fr.txt',

    /** Dandelion Sprout's Nordic Filters (Norwegian, Danish, Icelandic, etc.) */
    NORDIC: 'https://raw.githubusercontent.com/DandelionSprout/adfilt/master/NorwegianExperimentalList%20alternate%20versions/NordicFiltersABP-Inclusion.txt',

    /** EasyList Polish */
    POLISH: 'https://easylist-downloads.adblockplus.org/easylistpolish.txt',

    /** EasyList Portuguese */
    PORTUGUESE: 'https://easylist-downloads.adblockplus.org/easylistportuguese.txt',

    /** ROList (Romanian) */
    ROMANIAN: 'https://www.zoso.ro/pages/rolist.txt',

    /** RU AdList (Russian/Ukrainian) */
    RUSSIAN: 'https://easylist-downloads.adblockplus.org/advblock.txt',

    /** EasyList Spanish */
    SPANISH: 'https://easylist-downloads.adblockplus.org/easylistspanish.txt',
};