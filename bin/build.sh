## Adjust the date after you run this to the date you ran it: 
bin/update-git-log.bash --since "2026-06-30" > _doco/lifecycle/CHANGELOG-new.md

vi _doco/lifecycle/CHANGELOG.md

rm _doco/lifecycle/CHANGELOG-new.md

node bin/version-update.js ./version.json

vi ./version.json

node bin/version-read.js

## NOW tag and commit

npm run package:deploy 
## ==>  dist/infinite-neck-20260628-193718.tar.gz

## Your ssh login here:
export SSH_LAR=    
export DEPLOY_DATE='20260628-194730'

scp dist/infinite-neck-$DEPLOY_DATE.tar.gz $SSH_LAR@demo.laramiecrocker.com:/home/laramiessh/sites/demo.laramiecrocker.com/

######### ON THE SERVER  ####################

ssh $SSH_LAR@demo.laramiecrocker.com

## Adjust the dates, and do something like: 

export DEPLOY_VERSION='v2.1-beta-7'
export DEPLOY_DATE='20260628-194730'

cd sites/demo.laramiecrocker.com
mkdir infinite-neck-deploy
cd infinite-neck-deploy
mv ../infinite-neck-$DEPLOY_DATE.tar.gz .
tar xvf infinite-neck-$DEPLOY_DATE.tar.gz
rm infinite-neck-$DEPLOY_DATE.tar.gz
cd ..
mv infinite-neck infinite-neck-$DEPLOY_VERSION; mv infinite-neck-deploy infinite-neck