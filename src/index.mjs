/**
 * @file src/index.mjs
 * @description Main entry point for the divortio-domainXOR worker. This worker exposes an RPC
 * service and an HTTP endpoint for checking domain existence against a hybrid filter.
 * @module WorkerEntrypoint
 */

import { WorkerEntrypoint } from 'cloudflare:workers';
import { domainExists as performLookup } from './domainXOR/lookup.mjs';

/**
 * @typedef {object} Env
 * @property {ArrayBuffer} EXACT_XOR_BUFFER - Binding to the exactXOR.bin data blob.
 * @property {ArrayBuffer} WILDCARD_XOR_BUFFER - Binding to the wildcardXOR.bin data blob.
 * @property {ArrayBuffer} PSL_TRIE_BUFFER - Binding to the pslTrie.bin data blob.
 */

export default class extends WorkerEntrypoint {
    /**
     * [RPC Method] Checks if a domain exists in the compiled lists.
     * @param {string | null | undefined} domain - The domain to check.
     * @returns {boolean} True if the domain exists.
     */
    domainExists(domain) {
        // Pass all necessary buffers to the lookup module.
        // The lookup module will handle its own one-time initialization.
        return performLookup(domain, {
            exactXOR: this.env.EXACT_XOR_BUFFER,
            wildcardXOR: this.env.WILDCARD_XOR_BUFFER,
            pslTrie: this.env.PSL_TRIE_BUFFER
        });
    }

    /**
     * The main HTTP fetch handler. Checks the hostname of the incoming request.
     * @param {import('@cloudflare/workers-types').Request} request
     * @returns {Promise<import('@cloudflare/workers-types').Response>}
     */
    async fetch(request) {
        const url = new URL(request.url);
        const domainToCheck = url.hostname;

        const exists = this.domainExists(domainToCheck);

        const status = exists ? 200 : 404;
        const responseBody = {
            domain: domainToCheck,
            exists: exists,
        };

        return new Response(JSON.stringify(responseBody, null, 2), {
            status: status,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}