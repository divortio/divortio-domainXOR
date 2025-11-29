# 🛠️ Build System

The build system (`npm run build`) is the heart of the project. It is responsible for turning raw, messy blocklists into highly optimized binary artifacts.

## Configuration
Sources are defined in `lists.js`. You can add any URL that returns a text file in one of the supported formats:
* **Hosts File:** `0.0.0.0 domain.com`
* **Adblock:** `||domain.com^`
* **Plain:** `domain.com`

## Commands

| Command | Description |
| :--- | :--- |
| `npm run build` | **Full Pipeline:** Fetch -> Parse -> Build -> Verify -> Report. |
| `npm test` | Runs unit tests and the integration suite. |
| `npm run deploy` | Builds the project and deploys to Cloudflare. |
| `node test/benchmark.mjs` | Runs the performance benchmark against the Tranco 1M list. |
| `npm run clean` | Clears local list cache. |

## Artifacts
The build outputs files to `src/built/bins/`:

1.  **`exactXOR.bin`**: The filter for domains listed explicitly (e.g., `malware.site`).
2.  **`wildcardXOR.bin`**: The filter for wildcard rules (e.g., `*.doubleclick.net`).
3.  **`pslTrie.bin`**: The Public Suffix List, compiled into a binary Trie for fast TLD detection.

