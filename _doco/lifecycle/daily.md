# Daily Command-lines

## Update _doco
```
cd ~/infinite-neck
bin/index.md-update-all.sh
bin/documentation.sh 
```

## Run Jest Tests
```
cd ~/infinite-neck
export INFINITE_NECK_VERBOSE=-1
node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose  --runInBand
```
    
### Run Jest Tests with more output
 - This gives a quiet output.
 - The Jest flag --verbose gives some test details.  
 - Use INFINITE_NECK_VERBOSE=1 etc. for even more.
 - To see a Jest list of songs loaded: 
```
export INFINITE_NECK_VERBOSE=-1 ;      node --experimental-vm-modules node_modules/.bin/jest _tests/jest/song-load-new.test.js --verbose
```
 - To really see the details on loading songs:
```
export INFINITE_NECK_VERBOSE=2 ;      node --experimental-vm-modules node_modules/.bin/jest _tests/jest/song-load-new.test.js
```
 - To see the version info: 
```
export INFINITE_NECK_VERBOSE=1 ; node --experimental-vm-modules node_modules/.bin/jest _tests/jest/version.test.js
```


## Jest test script rewrite: 
with args:
node --experimental-vm-modules jest "$@"
without args:
node --experimental-vm-modules jest _tests/jest/ --verbose
Validation

Targeted invocation:
.run-jest.sh --listTests _tests/jest/transpose-plugin.test.js
returned only transpose-plugin.test.js
Default invocation:
.run-jest.sh --listTests
returned the broader test list under jest

## Push new version

 - [Run Jest Tests](#run-jest-tests)
 
 - Create a TAG in CHANGELOG.md, **_but not in git yet_**:
  - Update ./_doco/lifecycle/CHANGELOG.md
  - Include the TAG, and any relevant comments from `git log`
  - get the log: 
```
git fetch origin
git checkout fix/my-branch
git log origin/master..HEAD --pretty=format:"- %s"
```

 - Run the version-update.js command to update version.json, then check it.
 
```    
cd ~/infinite-neck
node bin/version-update.js ./version.json
node bin/version-read.js
```

 - To see the version info in the Jest test: 
```
export INFINITE_NECK_VERBOSE=1 ; node --experimental-vm-modules node_modules/.bin/jest _tests/jest/version.test.js
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

 - don't use the Dreamhost uploader.  It can silently omit files and barf.
 - Do use tar and scp: 
```
cd ~/infinite-neck-deploy
git archive --format=tar.gz --output=./infinite-neck-deploy.tar.gz stable-20260320
scp infinite-neck-deploy.tar.gz laramiessh@demo.laramiecrocker.com:~/sites/demo.laramiecrocker.com/infinite-neck-deploy/
```
- that dir should exist
- ssh in and clean out the dir except the .tar.gz
- check the file date, then un-tar it.
```
tar xcv infinite-neck-deploy.tar.gz
```

### Safely Rebase to get working branch to be 0 ahead/ 0 behind "master"

```sh
git checkout fix/attr-value
git fetch origin
git rebase origin/master
git push --force-with-lease
```

### To validate the command-line menu

```
npm run validate:cmdmenu
```
     
