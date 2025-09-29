/**
 * @file /build/serializeTrie.mjs
 * @description A module for serializing the flattened Trie into a compact binary format.
 * @module SerializeTrie
 */

/**
 * @typedef {import('./flattenTrie.mjs').FlatTrieNode} FlatTrieNode
 */

const NODE_BLOCK_SIZE = 4; // Each node is represented by 4 Uint32s

/**
 * Converts the flattened Trie array into the final binary ArrayBuffer.
 * This process involves creating a string table for all unique labels and then
 * writing the node data (pointers and flags) into a Uint32Array.
 *
 * @param {FlatTrieNode[]} flatNodes - The flattened array of Trie nodes.
 * @returns {Buffer} A Node.js Buffer containing the final binary Trie data.
 */
export function serializeTrie(flatNodes) {
    const stringTableMap = new Map();
    let stringTable = '';
    const finalNodeArray = new Uint32Array(flatNodes.length * NODE_BLOCK_SIZE);

    for (let i = 0; i < flatNodes.length; i++) {
        const node = flatNodes[i];

        // Build the string table, storing only unique labels.
        if (!stringTableMap.has(node.label)) {
            const ref = stringTable.length;
            stringTableMap.set(node.label, ref);
            stringTable += node.label + '\0'; // Null-terminate strings for easy parsing
        }

        const offset = i * NODE_BLOCK_SIZE;
        // Write the 4 components of the node into the Uint32Array.
        finalNodeArray[offset] = stringTableMap.get(node.label);      // Pointer to label
        finalNodeArray[offset + 1] = node.firstChildPtr * NODE_BLOCK_SIZE;  // Pointer to first child
        finalNodeArray[offset + 2] = node.nextSiblingPtr * NODE_BLOCK_SIZE; // Pointer to next sibling
        finalNodeArray[offset + 3] = node.flags;                      // Flags for matches
    }

    // Assemble the final binary file: [4-byte header][string table][node data]
    const stringTableBuffer = Buffer.from(stringTable, 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(stringTableBuffer.length, 0);

    return Buffer.concat([header, stringTableBuffer, Buffer.from(finalNodeArray.buffer)]);
}