/**
 * @file /build/createInMemoryTrie.mjs
 * @description A module for building the in-memory Trie object from a domain list.
 * @module CreateInMemoryTrie
 */

/**
 * @typedef {object} InMemoryTrieNode
 * @property {boolean} [isEnd] - Marks an exact domain match.
 * @property {boolean} [isWildcard] - Marks a wildcard domain match.
 * @property {Object<string, InMemoryTrieNode>} [children] - Child nodes.
 */

/**
 * Builds an in-memory Trie structure from a list of domains. This nested object
 * is an intermediate representation that is easy to work with before it gets
 * flattened and serialized into a binary format.
 *
 * @param {string[]} domains - A flat array of unique domain strings.
 * @returns {InMemoryTrieNode} The root of the in-memory Trie.
 */
export function createInMemoryTrie(domains) {
    const root = {};
    for (let domain of domains) {
        let isWildcard = false;
        if (domain.startsWith('*.')) {
            isWildcard = true;
            domain = domain.substring(2); // Remove wildcard prefix for insertion
        }

        const sanitizedDomain = domain.toLowerCase().trim();
        if (sanitizedDomain.length === 0) continue;

        const parts = sanitizedDomain.split('.').reverse();
        let currentNode = root;
        for (const part of parts) {
            if (!currentNode.children) currentNode.children = {};
            if (!currentNode.children[part]) currentNode.children[part] = {};
            currentNode = currentNode.children[part];
        }

        // Merge flags if a domain is both an exact match and a wildcard
        if (isWildcard) {
            currentNode.isWildcard = true;
        } else {
            currentNode.isEnd = true;
        }
    }
    return root;
}