/**
 * @file build/trie/buildTrie.mjs
 * @description A generic, reusable module for building a binary Trie.
 * It provides functions to create a nested in-memory Trie from a list of strings,
 * flatten it into a structured array, and serialize it into a compact binary format.
 * @module TrieBuilder
 */

/**
 * @typedef {object} InMemoryTrieNode
 * @property {number} flags - Bitmask for the node (e.g., 1 for isEnd, 2 for isWildcard).
 * @property {Object<string, InMemoryTrieNode>} [children] - Child nodes, keyed by label.
 */

/**
 * @typedef {object} FlatTrieNode
 * @property {string} label - The string label for this node.
 * @property {number} firstChildPtr - The index of the first child in the flattened array.
 * @property {number} nextSiblingPtr - The index of the next sibling in the flattened array.
 * @property {number} flags - The bitmask for this node.
 */

const NODE_BLOCK_SIZE = 4; // Each node is represented by 4 * Uint32 (16 bytes)

/**
 * Creates a nested, in-memory Trie object from a list of dot-delimited strings.
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

        currentNode.flags |= flags;
    }
    return root;
}

const flatNodes = [];

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
 * The output format is: [Header: StringTableLength][StringTable + Padding][NodeDataArray]
 * * CRITICAL: The StringTable must be padded to a 4-byte boundary so that the
 * NodeDataArray (Uint32Array) starts at an aligned offset.
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

    let stringTableBuffer = Buffer.from(stringTable, 'utf8');

    // CRITICAL FIX: Memory Alignment
    // Calculate required padding to ensure the string table ends on a 4-byte boundary.
    // Uint32Array in the runtime REQUIRES its start offset to be a multiple of 4.
    const paddingNeeded = (4 - (stringTableBuffer.length % 4)) % 4;

    if (paddingNeeded > 0) {
        const padding = Buffer.alloc(paddingNeeded, 0); // Pad with nulls
        stringTableBuffer = Buffer.concat([stringTableBuffer, padding]);
    }

    const header = Buffer.alloc(4);
    // Write the PADDED length to the header.
    // This allows the runtime to simply do (4 + length) to find the start of the nodes.
    header.writeUInt32LE(stringTableBuffer.length, 0);

    return Buffer.concat([header, stringTableBuffer, Buffer.from(finalNodeArray.buffer)]);
}

export function buildTrie(items, flagSetter) {
    const inMemoryTrie = createInMemoryTrie(items, flagSetter);

    flatNodes.length = 0;

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