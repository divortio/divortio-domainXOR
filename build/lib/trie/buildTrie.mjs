/**
 * @file build/lib/trie/buildTrie.mjs
 * @description A generic, reusable module for building a binary Trie from a list of strings.
 * It provides functions to create a nested in-memory Trie, flatten it into a linear array structure,
 * and serialize it into a compact binary format suitable for zero-allocation runtimes.
 * @module TrieBuilder
 */

/**
 * Represents a node in the intermediate in-memory recursive Trie structure.
 * @typedef {object} InMemoryTrieNode
 * @property {number} flags - Bitmask for the node (e.g., 1 for isEnd, 2 for isWildcard).
 * @property {Record<string, InMemoryTrieNode>} [children] - Child nodes, keyed by their string label.
 */

/**
 * Represents a node in the flattened, linear array structure before binary serialization.
 * @typedef {object} FlatTrieNode
 * @property {string} label - The string label for this node (segment of the domain).
 * @property {number} firstChildPtr - The array index of the first child node.
 * @property {number} nextSiblingPtr - The array index of the next sibling node.
 * @property {number} flags - The integer bitmask for this node.
 */

/**
 * The size of a serialized node in bytes.
 * Structure: [LabelOffset (4), FirstChildPtr (4), NextSiblingPtr (4), Flags (4)]
 * @constant {number}
 */
const NODE_BLOCK_SIZE = 4; // 4 * Uint32 (16 bytes)

/**
 * A shared array to store flattened nodes during the recursive flattening process.
 * Cleared at the beginning of each build.
 * @type {FlatTrieNode[]}
 */
const flatNodes = [];

/**
 * Creates a nested, in-memory Trie object from a list of dot-delimited strings.
 *
 * @param {string[]} items - The list of strings (e.g., domains) to insert into the Trie.
 * @param {(item: string) => number} flagSetter - A callback function to determine the flag value for a terminal node.
 * @returns {InMemoryTrieNode} The root node of the constructed in-memory Trie.
 */
function createInMemoryTrie(items, flagSetter) {
    const root = { flags: 0 };

    for (let item of items) {
        const sanitizedItem = item.toLowerCase().trim();
        if (sanitizedItem.length === 0) continue;

        const flags = flagSetter(sanitizedItem);
        // Split domain into parts and reverse (e.g., "a.b.com" -> ["com", "b", "a"])
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

/**
 * Recursively flattens an in-memory Trie node and its children into the `flatNodes` array.
 * Converts recursive references into integer array indices (pointers).
 *
 * @param {InMemoryTrieNode} node - The in-memory node to flatten.
 * @returns {number} The index of the flattened node in the `flatNodes` array.
 */
function _flattenNode(node) {
    const { flags = 0, children = {} } = node;
    const childrenEntries = Object.entries(children);

    // Recursively flatten children first (post-order traversalish)
    // We map children to their new indices in the flat array
    const childIndices = childrenEntries.map(([label, childNode]) => {
        const childIndex = _flattenNode(childNode);
        // The child node was just pushed to flatNodes; set its label now
        flatNodes[childIndex].label = label;
        return childIndex;
    });

    // Create the definition for the current node
    const nodeIndex = flatNodes.length;
    const nodeData = {
        label: '', // Label is set by the parent (or stays empty for root)
        firstChildPtr: childIndices.length > 0 ? childIndices[0] : 0,
        nextSiblingPtr: 0,
        flags: flags,
    };
    flatNodes.push(nodeData);

    // Link children as a linked list using nextSiblingPtr
    for (let i = 0; i < childIndices.length - 1; i++) {
        flatNodes[childIndices[i]].nextSiblingPtr = childIndices[i + 1];
    }

    return nodeIndex;
}

/**
 * Serializes a flattened Trie array into a compact binary Buffer.
 * The output format is: [Header: StringTableLength][StringTable + Padding][NodeDataArray].
 *
 * CRITICAL: The StringTable is padded to a 4-byte boundary. This ensures that the
 * NodeDataArray (which is accessed as a Uint32Array) starts at a memory-aligned offset,
 * preventing alignment faults or performance penalties in the runtime.
 *
 * @param {FlatTrieNode[]} flattenedNodes - The array of flattened node objects.
 * @returns {Buffer} A Node.js Buffer containing the fully serialized binary Trie.
 */
function serializeFlatTrie(flattenedNodes) {
    const stringTableMap = new Map();
    let stringTable = '';
    const finalNodeArray = new Uint32Array(flattenedNodes.length * NODE_BLOCK_SIZE);

    for (let i = 0; i < flattenedNodes.length; i++) {
        const node = flattenedNodes[i];

        // Deduplicate labels in the String Table
        if (!stringTableMap.has(node.label)) {
            const ref = stringTable.length;
            stringTableMap.set(node.label, ref);
            stringTable += node.label + '\0'; // Null-terminated strings
        }

        const offset = i * NODE_BLOCK_SIZE;
        // 0: Label Pointer (offset into string table)
        finalNodeArray[offset] = stringTableMap.get(node.label);
        // 1: First Child Pointer (byte offset in node array)
        finalNodeArray[offset + 1] = node.firstChildPtr * NODE_BLOCK_SIZE;
        // 2: Next Sibling Pointer (byte offset in node array)
        finalNodeArray[offset + 2] = node.nextSiblingPtr * NODE_BLOCK_SIZE;
        // 3: Flags
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

/**
 * The main entry point to build and serialize a Trie from a list of items.
 * Orchestrates creation, flattening, and binary serialization.
 *
 * @param {string[]} items - An array of strings to build the Trie from.
 * @param {(item: string) => number} flagSetter - A function that returns the flag bits for a given item.
 * @returns {Buffer} The complete, serialized binary Trie ready for file output.
 */
export function buildTrie(items, flagSetter) {
    const inMemoryTrie = createInMemoryTrie(items, flagSetter);

    // Reset shared state
    flatNodes.length = 0;

    // Flatten the root's children (the root itself has no label and is implicit)
    const rootChildrenEntries = Object.entries(inMemoryTrie.children || {});
    const rootChildIndices = rootChildrenEntries.map(([label, childNode]) => {
        const childIndex = _flattenNode(childNode);
        flatNodes[childIndex].label = label;
        return childIndex;
    });

    // Link root children
    for (let i = 0; i < rootChildIndices.length - 1; i++) {
        flatNodes[rootChildIndices[i]].nextSiblingPtr = rootChildIndices[i + 1];
    }

    return serializeFlatTrie(flatNodes);
}