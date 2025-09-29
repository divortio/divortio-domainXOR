/**
 * @file /build/trieBuilder.mjs
 * @description A generic, reusable module for building a binary Trie.
 * @module TrieBuilder
 */

/**
 * @typedef {object} InMemoryTrieNode
 * @property {number} flags - Bitmask for the node (e.g., isEnd, isWildcard).
 * @property {Object<string, InMemoryTrieNode>} [children] - Child nodes.
 */

/**
 * @typedef {object} FlatTrieNode
 * @property {string} label - The string label for this node.
 * @property {number} firstChildPtr - The index of the first child in the flattened array.
 * @property {number} nextSiblingPtr - The index of the next sibling in the flattened array.
 * @property {number} flags - The bitmask for this node.
 */

const NODE_BLOCK_SIZE = 4; // Each node is 4 * Uint32

/**
 * Creates a nested, in-memory Trie object from a list of strings.
 * @param {string[]} items - An array of dot-delimited strings.
 * @param {Function} flagSetter - A function that receives a string and returns a flag number (e.g., 1 for exact match).
 * @returns {InMemoryTrieNode} The root of the in-memory Trie.
 */
function createInMemoryTrie(items, flagSetter) {
    const root = { flags: 0 };
    for (let item of items) {
        const sanitizedItem = item.toLowerCase().trim();
        if (sanitizedItem.length === 0) continue;

        const flags = flagSetter(sanitizedItem);
        const parts = sanitizedItem.split('.').reverse();
        let currentNode = root;

        for (const part of parts) {
            if (!currentNode.children) currentNode.children = {};
            if (!currentNode.children[part]) currentNode.children[part] = { flags: 0 };
            currentNode = currentNode.children[part];
        }
        currentNode.flags |= flags; // Merge flags
    }
    return root;
}

/**
 * A global array to hold the nodes as they are flattened.
 * @type {FlatTrieNode[]}
 */
const flatNodes = [];

/**
 * Recursively flattens a nested Trie object into a flat array.
 * @private
 * @param {InMemoryTrieNode} node - The current node to process.
 * @returns {number} The index of the flattened node in the `flatNodes` array.
 */
function _flattenNode(node) {
    const nodeIndex = flatNodes.length;
    const { flags = 0, children = {} } = node;
    const childrenEntries = Object.entries(children);

    const childIndices = childrenEntries.map(([label, childNode]) => {
        const childIndex = _flattenNode(childNode);
        flatNodes[childIndex].label = label;
        return childIndex;
    });

    const nodeData = {
        label: '',
        firstChildPtr: childIndices.length > 0 ? childIndices[0] : 0,
        nextSiblingPtr: 0,
        flags: flags,
    };
    flatNodes.push(nodeData);

    for (let i = 0; i < childIndices.length - 1; i++) {
        flatNodes[childIndices[i]].nextSiblingPtr = childIndices[i + 1];
    }

    return nodeIndex;
}

/**
 * Serializes a flattened Trie array into a compact binary Buffer.
 * @param {FlatTrieNode[]} flattenedNodes - The flat array representation of the Trie.
 * @returns {Buffer} A Node.js Buffer containing the final binary Trie data.
 */
function serializeFlatTrie(flattenedNodes) {
    const stringTableMap = new Map();
    let stringTable = '';
    const finalNodeArray = new Uint32Array(flattenedNodes.length * NODE_BLOCK_SIZE);

    for (let i = 0; i < flattenedNodes.length; i++) {
        const node = flattenedNodes[i];
        if (!stringTableMap.has(node.label)) {
            const ref = stringTable.length;
            stringTableMap.set(node.label, ref);
            stringTable += node.label + '\0';
        }

        const offset = i * NODE_BLOCK_SIZE;
        finalNodeArray[offset] = stringTableMap.get(node.label);
        finalNodeArray[offset + 1] = node.firstChildPtr * NODE_BLOCK_SIZE;
        finalNodeArray[offset + 2] = node.nextSiblingPtr * NODE_BLOCK_SIZE;
        finalNodeArray[offset + 3] = node.flags;
    }

    const stringTableBuffer = Buffer.from(stringTable, 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(stringTableBuffer.length, 0);

    return Buffer.concat([header, stringTableBuffer, Buffer.from(finalNodeArray.buffer)]);
}

/**
 * The main exported function. It takes a list of strings and a flag-setting
 * function, and returns a fully serialized binary Trie.
 * @param {string[]} items - An array of dot-delimited strings to build the Trie from.
 * @param {Function} flagSetter - A callback function that determines the flag for each item.
 * @returns {Buffer} The final binary Trie as a Node.js Buffer.
 */
export function buildTrie(items, flagSetter) {
    const inMemoryTrie = createInMemoryTrie(items, flagSetter);

    // Flatten the Trie
    flatNodes.length = 0; // Clear the global array
    const rootChildrenEntries = Object.entries(inMemoryTrie.children || {});
    const rootChildIndices = rootChildrenEntries.map(([label, childNode]) => {
        const childIndex = _flattenNode(childNode);
        flatNodes[childIndex].label = label;
        return childIndex;
    });
    for (let i = 0; i < rootChildIndices.length - 1; i++) {
        flatNodes[rootChildIndices[i]].nextSiblingPtr = rootChildIndices[i + 1];
    }

    return serializeFlatTrie(flatNodes);
}