

import { OISD } from './lib/oisd.mjs';
import { URLHAUS } from './lib/urlhaus.mjs';
import { PHISHING_ARMY } from './lib/phishingArmy.mjs';
import { EASY_LIST } from './lib/easyList.mjs';
import { NO_TRACKING } from './lib/noTracking.mjs';
import { HAGEZI } from './lib/hagezi.mjs';
import { STEVEN_BLACK } from './lib/stevenBlack.mjs';
import { AD_AWAY } from './lib/adaway.mjs';
import { AD_GUARD } from './lib/adguard.mjs';
import { PERFLYST } from './lib/perflyst.mjs';
import { ANUDEEP } from './lib/anudeep.mjs';

import { ONE_HOSTS } from './lib/oneHosts.mjs';
import { ENERGIZED } from './lib/energized.mjs';
import { GOODBYE_ADS } from './lib/goodbyeAds.mjs';
import { BLOCKLIST_PROJECT } from './lib/blocklistProject.mjs';


/**
 *
 * @type {{OISD: {BIG: string, SMALL: string, NSFW: string, NSFW_SMALL: string}, URLHAUS: {DEFAULT: string}, PHISHING_ARMY: {EXTENDED: string, BLOCKLIST: string}, EASY_LIST: {ADS: string, PRIVACY: string, ANNOYANCE: string, SOCIAL: string, ANTI_ADBLOCK: string, ADS_NO_ELEMENT_HIDING: string, ADS_NO_ADULT: string, PRIVACY_NO_INTL: string, INDONESIAN: string, VIETNAMESE: string, BULGARIAN: string, CHINESE: string, CZECH_SLOVAK: string, DUTCH: string, GERMAN: string, HEBREW: string, INDIAN: string, ITALIAN: string, KOREAN: string, LITHUANIAN: string, LATVIAN: string, ARABIC: string, FRENCH: string, NORDIC: string, POLISH: string, PORTUGUESE: string, ROMANIAN: string, RUSSIAN: string, SPANISH: string}, NO_TRACKING: {DEFAULT: string}, HAGEZI: {LIGHT: string, NORMAL: string, PRO: string, PRO_PLUS: string, ULTIMATE: string, TIF: string}, STEVEN_BLACK: Object<string, string>, AD_AWAY: {DEFAULT: string}, AD_GUARD: {DNS_FILTER: string}, PERFLYST: {SMART_TV: string, FIRE_TV: string, ANDROID_TRACKING: string}, ANUDEEP: {ADSERVERS: string, FACEBOOK: string}, ONE_HOSTS: {LITE: string, MINI: string, PRO: string, XTRA: string}, ENERGIZED: {SPARK: string, BLU: string, BASIC: string, ULTIMATE: string, UNIFIED: string, PORN: string}, GOODBYE_ADS: {MAIN: string, YOUTUBE: string, SPOTIFY: string, XIAOMI: string, SAMSUNG: string}, BLOCKLIST_PROJECT: {ADS: string, TRACKING: string, MALWARE: string, FRAUD: string, GAMBLING: string, DRUGS: string, EVERYTHING: string}}}
 */
export const BLOCK_LISTS = {
    OISD,
    URLHAUS,
    PHISHING_ARMY,
    EASY_LIST,
    NO_TRACKING,
    HAGEZI,
    STEVEN_BLACK,
    AD_AWAY,
    AD_GUARD,
    PERFLYST,
    ANUDEEP,
    ONE_HOSTS,
    ENERGIZED,
    GOODBYE_ADS,
    BLOCKLIST_PROJECT
}


