# Daily Command-lines

- Update _doco:
    ```
        cd ~/infinite-neck
        bin/index.md-update-all.sh
    ```

- Run Jest tests:
    ```
        cd ~/infinite-neck
        export INFINITE_NECK_VERBOSE=-1
        node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose  --runInBand
    ```

- Push new version
    - Create a TAG
    - Run the version-update.js command to update version.json, then check it.
    
        ```    cd ~/infinite-neck
        node bin/version-update.js ./version.json
        node bin/version-read.js
        ```
    - In general, we want pushed versions to be equal to the TAG:

        ```
            stable-after-refactors-20260318
        ```
    - If you see something like this, it's OK, but it means you are:
        - `3` commits ahead of tag `stable-after-refactors-20260318` of commit `gab35b69`

            ```sh
                stable-after-refactors-20260318-3-gab35b69
            ```
    - Then, in the web browser, in the command-line run `/fv` and `/fV` to check that the browser is picking up the new version string.        
