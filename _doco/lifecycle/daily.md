# Daily Command-lines

## Copilot SOP and instructions

`.github/copilot-instructions.md`

## sprint planning documents

[_doco/lifecycle/sprints.md](../lifecycle/sprints.md)

## Update _doco
```
cd ~/infinite-neck
bin/index.md-update-all.sh
bin/documentation.sh 
```


### To validate the command-line menu
```
npm run validate:cmdmenu
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
cd ~/infinite-neck
bin/update-git-log.bash --since "2026-03-25" > _doco/lifecycle/CHANGELOG-new.md
```

Adjust the --since date, update the tag in CHANGELOG.md, and then grab all the log lines and past into CHANGELOG.md from CHANGELOG-new.md, then 

```
rm _doco/lifecycle/CHANGELOG-new.md
```

 - Run the version-update.js command to update version.json with the date.
 
```    
cd ~/infinite-neck
node bin/version-update.js ./version.json
```
Now *manually* update the version.json file to have the tag you are *going to* create: 

vi version.json
   ==> "gitTag": "v2.1-beta-3"

Now check the version: 
```
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
 - Then, in the web browser, in the command-line run `/fav` and `/faV` to check that the browser is picking up the new version string. 

 - Once you know the version string is in the files, go ahead and tag the repository so the tag includes the version string and CHANGELOG.md.  

 - don't use the Dreamhost uploader.  It can silently omit files and barf.
 - Do use the "new deploy tar action" below, then scp or Dreamhost upload the tarfile. 

 ```
scp dist/infinite-neck-20260616-173854.tar.gz ssh-user-name@demo.laramiecrocker.com:/home/laramiessh/sites/demo.laramiecrocker.com/
 ```

### new deploy tar action

```
npm run package:deploy 
```

- creates a tar file in ./dist/

scp dist/infinite-neck-20260616-173854.tar.gz ssh-user-name@demo.laramiecrocker.com:/home/laramiessh/sites/demo.laramiecrocker.com/

### on the server

ssh ssh-user-name@demo.laramiecrocker.com

Adjust the dates, and do something like: 
```
cd sites/demo.laramiecrocker.com
dir
mv infinite-neck infinite-neck-20260610
mkdir infinite-neck
cd infinite-neck
mv ../infinite-neck-20260612-084929.tar.gz .
tar xvf infinite-neck-20260612-084929.tar.gz 
```

### Safely Rebase to get working branch to be 0 ahead/ 0 behind "master"

```sh
git checkout fix/attr-value
git fetch origin
git rebase origin/master
git push --force-with-lease
```


### OLD INSTRUCTIONS -- OBVIATED BY INSTRUCTIONS ABOVE

#### DEPLOY 
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

#### Old Jest strategy



     
