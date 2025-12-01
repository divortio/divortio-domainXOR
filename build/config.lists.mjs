/**
 * @file build/config.lists.mjs
 * @description Central configuration for active Domain Blocklist sources.
 *
 * This file aggregates all individual source modules from `build/lists/` and exports
 * the final `BLOCK_LIST_URLS` array used by the build pipeline.
 *
 * It serves as a complete catalog of all available lists in the system.
 * Developers can toggle lists by uncommenting the lines below.
 *
 * @module BuildConfig/Lists
 */

import { OISD } from './lists/lib/oisd.mjs';
import { URLHAUS } from './lists/lib/urlhaus.mjs';
import { PHISHING_ARMY } from './lists/lib/phishingArmy.mjs';
import { EASY_LIST } from './lists/lib/easyList.mjs';
import { NO_TRACKING } from './lists/lib/noTracking.mjs';
import { HAGEZI } from './lists/lib/hagezi.mjs';
import { STEVEN_BLACK } from './lists/lib/stevenBlack.mjs';
import { AD_AWAY } from './lists/lib/adaway.mjs';
import { AD_GUARD } from './lists/lib/adguard.mjs';
import { PERFLYST } from './lists/lib/perflyst.mjs';
import { ANUDEEP } from './lists/lib/anudeep.mjs';

import { ONE_HOSTS } from './lists/lib/oneHosts.mjs';
import { ENERGIZED } from './lists/lib/energized.mjs';
import { GOODBYE_ADS } from './lists/lib/goodbyeAds.mjs';
import { BLOCKLIST_PROJECT } from './lists/lib/blocklistProject.mjs';


/**
 * An array of URLs pointing to the active domain blocklists to be fetched and compiled.
 * @constant
 * @type {string[]}
 */
export const BLOCK_LIST_URLS = [
    // ==========================================
    // 🛡️  OISD (The Big Lists)
    // ==========================================
    OISD.BIG,
     OISD.SMALL,
    // OISD.NSFW,
    // OISD.NSFW_SMALL,

    // ==========================================
    // 🐈  StevenBlack (Unified Hosts)
    // ==========================================
    STEVEN_BLACK.UNIFIED,

    // -- Single Extensions --
    STEVEN_BLACK.FAKENEWS,
     STEVEN_BLACK.GAMBLING,
    // STEVEN_BLACK.PORN,
    // STEVEN_BLACK.SOCIAL,

    // -- Double Extensions --
    STEVEN_BLACK.FAKENEWS_GAMBLING,
    // STEVEN_BLACK.FAKENEWS_PORN,
    // STEVEN_BLACK.FAKENEWS_SOCIAL,
    // STEVEN_BLACK.GAMBLING_PORN,
    // STEVEN_BLACK.GAMBLING_SOCIAL,
    // STEVEN_BLACK.PORN_SOCIAL,

    // -- Triple Extensions --
    // STEVEN_BLACK.FAKENEWS_GAMBLING_PORN,
    // STEVEN_BLACK.FAKENEWS_GAMBLING_SOCIAL,
    // STEVEN_BLACK.FAKENEWS_PORN_SOCIAL,
    // STEVEN_BLACK.GAMBLING_PORN_SOCIAL,

    // -- Quadruple Extension --
    // STEVEN_BLACK.ALL,

    // ==========================================
    // 🧙‍♂️  HaGeZi (Multi-Tier Protection)
    // ==========================================
    HAGEZI.PRO_PLUS, // Recommended for comprehensive coverage
    HAGEZI.LIGHT,
    HAGEZI.NORMAL,
    HAGEZI.PRO,
    HAGEZI.ULTIMATE,
    HAGEZI.TIF, // Threat Intelligence Feed

    // ==========================================
    // 1️⃣  1Hosts (Strict Blocking)
    // ==========================================
    // ONE_HOSTS.LITE,
    // ONE_HOSTS.MINI,
    // ONE_HOSTS.PRO,
    // ONE_HOSTS.XTRA,

    // ==========================================
    // ⚡  Energized Protection
    // ==========================================
    // ENERGIZED.SPARK,
    // ENERGIZED.BLU,
    // ENERGIZED.BASIC,
    // ENERGIZED.ULTIMATE,
    // ENERGIZED.UNIFIED,
    // ENERGIZED.PORN,

    // ==========================================
    // 📃  EasyList & Fanboy (Adblock Standard)
    // ==========================================
    EASY_LIST.ADS, // EasyList
    EASY_LIST.PRIVACY, // EasyPrivacy
    EASY_LIST.ANNOYANCE,
    EASY_LIST.SOCIAL,
    EASY_LIST.ANTI_ADBLOCK,
    EASY_LIST.ADS_NO_ELEMENT_HIDING,
    EASY_LIST.ADS_NO_ADULT,
    EASY_LIST.PRIVACY_NO_INTL,

    // -- Regional Variants --
    // EASY_LIST.ARABIC,
    // EASY_LIST.BULGARIAN,
    EASY_LIST.CHINESE,
    // EASY_LIST.CZECH_SLOVAK,
    // EASY_LIST.DUTCH,
    // EASY_LIST.FRENCH,
    // EASY_LIST.GERMAN,
    // EASY_LIST.HEBREW,
    // EASY_LIST.INDIAN,
    // EASY_LIST.INDONESIAN,
    // EASY_LIST.ITALIAN,
    // EASY_LIST.KOREAN,
    // EASY_LIST.LATVIAN,
    // EASY_LIST.LITHUANIAN,
    // EASY_LIST.NORDIC,
    // EASY_LIST.POLISH,
    // EASY_LIST.PORTUGUESE,
    // EASY_LIST.ROMANIAN,
    EASY_LIST.RUSSIAN,
    // EASY_LIST.SPANISH,
    // EASY_LIST.VIETNAMESE,

    // ==========================================
    // ☣️  Threat Intelligence (Malware/Phishing)
    // ==========================================
    URLHAUS.DEFAULT,

    PHISHING_ARMY.EXTENDED,
    PHISHING_ARMY.BLOCKLIST,

    // ==========================================
    // 📱  Mobile & Smart Devices
    // ==========================================
    AD_AWAY.DEFAULT,
    AD_GUARD.DNS_FILTER,

    // -- Perflyst (Smart TV / IoT) --
    PERFLYST.SMART_TV,
    PERFLYST.FIRE_TV,
    PERFLYST.ANDROID_TRACKING,

    // -- GoodbyeAds (App Specific) --
    GOODBYE_ADS.MAIN,
    GOODBYE_ADS.YOUTUBE,
     GOODBYE_ADS.SPOTIFY,
    GOODBYE_ADS.XIAOMI,
    GOODBYE_ADS.SAMSUNG,

    // ==========================================
    // 🧱  The Block List Project (Categorized)
    // ==========================================
    BLOCKLIST_PROJECT.ADS,
    BLOCKLIST_PROJECT.TRACKING,
    BLOCKLIST_PROJECT.MALWARE,
    BLOCKLIST_PROJECT.FRAUD,
    BLOCKLIST_PROJECT.GAMBLING,
    // BLOCKLIST_PROJECT.DRUGS,
    // BLOCKLIST_PROJECT.EVERYTHING,

    // ==========================================
    // 🕵️  Curated & Safe
    // ==========================================
    ANUDEEP.ADSERVERS,
    // ANUDEEP.FACEBOOK,

    NO_TRACKING.DEFAULT, // "The Great Wall"
];