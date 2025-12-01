/**
 * @file build/steps/build.01a.whitelist.mjs
 * @description The Shadow Whitelist Generation Step (Step 1a).
 *
 * Generates `docs/build/WHITELIST.md` with clear distinctions between:
 * - **Forced Rescues**: Critical domains we unblocked manually.
 * - **Collisions**: Safe domains that statistically collided with the filter.
 *
 * @module BuildWhitelist
 */

import fs from 'fs';
import path from 'path';
import { buildShadowWhitelist } from '../lib/whitelist/buildShadowWhitelist.mjs';
import { writeAllStats } from '../lib/stats/statsCollector.js';
import { BUILD_DOCS_DIR } from '../config.mjs';

const REPORT_FILE = path.join(BUILD_DOCS_DIR, 'WHITELIST.md');

/**
 * Generates the Markdown report.
 * @param {{
 * count: number,
 * rescued: Array<{domain: string, reason: string}>
 * }} stats
 */
function generateReport(stats) {
    if (!fs.existsSync(BUILD_DOCS_DIR)) {
        fs.mkdirSync(BUILD_DOCS_DIR, { recursive: true });
    }

    const { count, rescued } = stats;
    const lines = [];

    lines.push(`# 🛡️ Shadow Whitelist Report`);
    lines.push(``);
    lines.push(`**Date:** ${new Date().toISOString()}`);
    lines.push(`**Total Rescued Domains:** ${new Intl.NumberFormat('en-US').format(count)}`);
    lines.push(``);
    lines.push(`This list contains domains that were blocked by the XOR filter logic but have been **rescued** (whitelisted) for the following reasons:`);
    lines.push(`- **Forced Critical/Recommended**: Explicitly allowed by configuration to prevent breakage.`);
    lines.push(`- **Collision (Top 1M)**: Statistically blocked but not present in any source blocklist.`);
    lines.push(``);
    lines.push(`| Index | Rescued Domain | Reason |`);
    lines.push(`| :--- | :--- | :--- |`);

    if (count === 0) {
        lines.push(`| - | *No rescues performed* | - |`);
    } else {
        // Sort by Reason (Forced first), then Domain
        rescued.sort((a, b) => {
            if (a.reason.startsWith('Forced') && !b.reason.startsWith('Forced')) return -1;
            if (!a.reason.startsWith('Forced') && b.reason.startsWith('Forced')) return 1;
            return a.domain.localeCompare(b.domain);
        });

        rescued.forEach((item, index) => {
            lines.push(`| ${index + 1} | \`${item.domain}\` | ${item.reason} |`);
        });
    }

    lines.push(``);
    lines.push(`---`);
    lines.push(`*Generated automatically by \`build/steps/build.01a.whitelist.mjs\`*`);

    fs.writeFileSync(REPORT_FILE, lines.join('\n'));
    console.log(`\n📄 Report saved to: ${path.relative(process.cwd(), REPORT_FILE)}`);
}

async function main() {
    try {
        console.log("--- Starting Shadow Whitelist Generation ---");

        const stats = buildShadowWhitelist();
        generateReport(stats);
        writeAllStats({});

        console.log("\n✅ Whitelist Generation Complete.");
    } catch (error) {
        console.error(`\n❌ Whitelist Generation Failed: ${error.message}`);
        process.exit(1);
    }
}

main();