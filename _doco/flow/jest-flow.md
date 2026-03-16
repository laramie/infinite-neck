# Table of Contents

- [Jest Configuration](#jest-configuration)
  - [`jest.config.js`](#jest-configuration)
  - [`package.json`](#jest-configuration)
  - [Do NOT do this](#jest-configuration)
  - [DO do this](#jest-configuration)
- [Working Jest Tests](#working-jest-tests)
  - [`ANSIColors.test.js` worked](#working-jest-tests)
  - [`RegexSuites.test.js` worked](#working-jest-tests)
  - [`Accumulator.test.js` worked](#working-jest-tests)
  - [`SampleStep.test.js` worked](#working-jest-tests)
  - [Run all tests in dir](#working-jest-tests)
- [Caching](#caching)
  - [WARNING: Jest does cache](#caching)
- [Test Verbosity](#test-verbosity)
  - [`INFINITE_NECK_VERBOSE`](#test-verbosity)
  - [Jest Verbosity in Jest based on running one test, or dirscan](#test-verbosity)

# Jest Configuration

- `jest.config.js`
  - must have:

    ```js
    export default {
        testEnvironment: 'node',
        transform: {},
    };
    ```
  - must NOT have:

    ```js
    export default {
        extensionsToTreatAsEsm: ['.js'],
        transform: {},
        testEnvironment: 'node',
    };
    ```

- `package.json`
  - must have:

    ```json
    "type": "module",
    ...
    "scripts": {
        "test": "echo \"Error: no test specified\" && exit 1",
        "knip": "knip"
    },
    ```
  - `scripts` is special section node runs when you say `npx` in a (bash) shell.
    - `npx test`      → runs the command in `{scripts.test}`
    - `npx knip`      → runs knip, which I installed with npm.
    - So if I install:

      ```json
      "scripts": {
          "test": "node --experimental-vm-modules node_modules/.bin/jest",
          "knip": "knip"
      }
      ```
    - Now npx knows to run my jest tests when I say:
      - `npx test`

- Do NOT do this:

    ```bash
    npx jest _tests/jest/namespacer/regex-suites.test.js
    ```

- DO do this:

    ```bash
    node --experimental-vm-modules node_modules/.bin/jest _tests/jest/namespacer/regex-suites.test.js
    ```
    - You must run with that flag because jest is all out of date 'nshit.

# Working Jest Tests

- `ANSIColors.test.js` worked:

    ```bash
    laramie@penguin:~/infinite-neck$ node --experimental-vm-modules node_modules/.bin/jest _tests/jest/namespacer/ANSIColors.test.js
    ```
- `RegexSuites.test.js` worked:

    ```bash
    laramie@penguin:~/infinite-neck$ node --experimental-vm-modules node_modules/.bin/jest _tests/jest/namespacer/RegexSuites.test.js
    ```
- `Accumulator.test.js` worked:

    ```bash
    laramie@penguin:~/infinite-neck$ node --experimental-vm-modules node_modules/.bin/jest _tests/jest/namespacer/Accumulator.test.js
    ```
- `SampleStep.test.js` worked:

    ```bash
    laramie@penguin:~/infinite-neck$ node --experimental-vm-modules node_modules/.bin/jest _tests/jest/namespacer/SampleStep.test.js
    ```

- Therefore, run this to run all tests in this dir:

    ```bash
    cd ~/infinite-neck$
    node --experimental-vm-modules node_modules/.bin/jest _tests/jest/namespacer/
    ```

# Caching

- WARNING: Jest does cache.
  - `jest --clearCache`
  - `npx jest --clearCache`
  - `jest --no-cache`

# Test Verbosity

- `INFINITE_NECK_VERBOSE`
  - I have all my tests set up to be verbose or terse.
  - It is controlled with an ENV var.  You can export that in bash:
    - infinite-neck Verbosity is set in infinite-neck in _tests/jest/namespacer/LogVerboseJest.js
    - To change it, set the env var:

      ```bash
      export INFINITE_NECK_VERBOSE=-1
      ```

    - or set it in VS Code from the GUI
      - (Ask HAL if you need the file format, but it goes in "configurations" parallel to "program": "${workspaceFolder}/node_modules/.bin/jest"):
      - Primary Side Bar
        - Run and Debug
          - Open "launch.json" (the little gear next to the run arrow dropdown at the top)
            - launch.json:

              ```json
              "env": {
                  "INFINITE_NECK_VERBOSE": "1"
              }
              ```

- Jest Verbosity in Jest based on running one test, or dirscan:
  - Option 1: Command line

    ```bash
    laramie@penguin:~/infinite-neck$ node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose
    # e.g.
    node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose
    ```
  - Option 2: jest.config.js

    ```js
    module.exports = {
        verbose: true,
        // ...other config
    };
    ```
  - Option 3: package.json

    ```json
    "jest": {
        "verbose": true
    }
    ```
