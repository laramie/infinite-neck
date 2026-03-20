// infinite-neck-headless.js
import * as neck from './infinite-neck.js';
import { getVersion } from './bin/version-read.js';

// Provide a headless-only version getter
export function readVersionHeadless() {
  return getVersion();
}

// Optionally, re-export everything else from infinite-neck.js
export * from './infinite-neck.js';