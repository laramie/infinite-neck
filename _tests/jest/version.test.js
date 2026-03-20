import { logVerbose, INFINITE_NECK_VERBOSE, VERBOSE_MODE, VERBOSE_MODE_INT } from './LogVerboseJest.js';
import { readVersionHeadless } from '../../infinite-neck-headless.js';

let versionObj;

beforeAll(async () => {
  versionObj = await readVersionHeadless();
});

describe('Version info (headless)', () => {
  test('readVersionHeadless returns an object with gitTag property', () => {
    expect(versionObj).toBeDefined();
    expect(typeof versionObj).toBe('object');
    expect(versionObj).toHaveProperty('gitTag');
    expect(typeof versionObj.gitTag).toBe('string');
    // Optionally, check for a non-empty string:
    expect(versionObj.gitTag.length).toBeGreaterThan(0);
    logVerbose(1, "Build Version: \n"+JSON.stringify(readVersionHeadless(),null,4));
       
  });
});