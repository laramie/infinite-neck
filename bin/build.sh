## Adjust the date: 
bin/update-git-log.bash --since "2026-06-21" > _doco/lifecycle/CHANGELOG-new.md

vi _doco/lifecycle/CHANGELOG.md

rm _doco/lifecycle/CHANGELOG-new.md

node bin/version-update.js ./version.json

vi ./version.json

node bin/version-read.js

npm run package:deploy 

## Your ssh login here:
export SSH_LAR=    

scp dist/infinite-neck-20260621-111937.tar.gz $SSH_LAR@demo.laramiecrocker.com:/home/laramiessh/sites/demo.laramiecrocker.com/

######### ON THE SERVER  ####################

ssh $SSH_LAR@demo.laramiecrocker.com

## Adjust the dates, and do something like: 

export DEPLOY_VERSION='v2.1-beta-6'
export DEPLOY_DATE='20260621-111937'

cd sites/demo.laramiecrocker.com
mkdir infinite-neck-deploy
cd infinite-neck-deploy
mv ../infinite-neck-$DEPLOY_DATE.tar.gz .
tar xvf infinite-neck-$DEPLOY_DATE.tar.gz
rm infinite-neck-$DEPLOY_DATE.tar.gz
cd ..
mv infinite-neck infinite-neck-$DEPLOY_VERSION; mv infinite-neck-deploy infinite-neck