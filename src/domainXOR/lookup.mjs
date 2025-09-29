/**
 * @file /src/xor/lookup.mjs
 * @description Manages the state and lookup logic for the PSL-Aware Hybrid Filter model.
 * @module XORLookup
 */

let isInitialized = false;
let exactFilter, wildcardFilter, pslTrieNodes, pslStringTableView;

// ... (Rest of the file remains the same, but for completeness, here it is) ...

const textDecoder = new TextDecoder();

/**
 * A 64-bit hashing function (splitmix64).
 * @private
 */
function splitmix64(n) {
    n += 0x9e3779b97f4a7c15;
    n = (n ^ (n >> 30)) * 0xbf58476d1ce4e5b9;
    n = (n ^ (n >> 27)) * 0x94d049bb133111eb;
    return n ^ (n >> 31);
}

/**
 * Hashes a string into a 64-bit integer.
 * @private
 */
function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
    }
    return splitmix64(h);
}

/**
 * Creates the three hash locations for an item in the filter.
 * @private
 */
function getHashLocations(keyHash, capacity) {
    const h0 = keyHash % capacity;
    const h1 = (keyHash >> 16) % capacity;
    const h2 = (keyHash >> 32) % capacity;
    return [h0, h1, h2];
}

function _init(buffers) {
    exactFilter = new BigUint64Array(buffers.exactXOR);
    wildcardFilter = new BigUint64Array(buffers.wildcardXOR);
    const pslBuffer = buffers.pslTrie;
    const pslStringTableLength = new Uint32Array(pslBuffer, 0, 1)[0];
    const pslStringTableEnd = 4 + pslStringTableLength;
    pslStringTableView = new DataView(pslBuffer, 4, pslStringTableLength);
    pslTrieNodes = new Uint32Array(pslBuffer, pslStringTableEnd);
    isInitialized = true;
    console.log(`Hybrid Filter System Initialized.`);
}

function _isPsl(parts) {
    let nodePtr = 0;
    for (const part of parts) {
        let foundPart = false;
        while (nodePtr !== 0) {
            const tempUint8 = new Uint8Array(pslStringTableView.buffer, pslStringTableView.byteOffset);
            const ref = pslTrieNodes[nodePtr];
            const end = tempUint8.indexOf(0, ref);
            const label = textDecoder.decode(tempUint8.subarray(ref, end));
            if (label === part) {
                nodePtr = pslTrieNodes[nodePtr + 1];
                foundPart = true;
                break;
            }
            nodePtr = pslTrieNodes[nodePtr + 2];
        }
        if (!foundPart) return false;
    }
    return (pslTrieNodes[nodePtr + 3] & 1) === 1;
}

/**
 * Performs a lookup in a binary XOR filter.
 * @private
 */
function _xorContains(item, filter) {
    if (filter.length === 0) return false;
    const h = BigInt(hash(item));
    const [h0, h1, h2] = getHashLocations(Number(h), filter.length);
    const fingerprint = h ^ filter[h1] ^ filter[h2];
    return filter[h0] === fingerprint;
}

export function domainExists(domain, buffers) {
    if (!isInitialized) {
        _init(buffers);
    }
    if (!domain) return false;
    const sanitizedDomain = domain.toLowerCase().trim();

    if (_xorContains(sanitizedDomain, exactFilter)) {
        return true;
    }

    const parts = sanitizedDomain.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
        const subdomainParts = parts.slice(i);
        const subdomain = subdomainParts.join('.');
        if (_isPsl(subdomainParts.slice().reverse())) {
            break;
        }
        if (_xorContains(subdomain, wildcardFilter)) {
            return true;
        }
    }
    return false;
}