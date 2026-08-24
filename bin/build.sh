## Adjust the date after you run this to the date you ran it: 
bin/update-git-log.bash --since "2026-08-23" > _doco/lifecycle/CHANGELOG-new.md

vi _doco/lifecycle/CHANGELOG.md

rm _doco/lifecycle/CHANGELOG-new.md

node bin/version-update.js ./version.json

# Use v2.1-beta-11

vi ./version.json

node bin/version-read.js

## NOW tag and commit

npm run package:deploy 
## ==>  dist/infinite-neck-20260823-190706.tar.gz

## Your ssh login here:
export SSH_LAR=    
export DEPLOY_DATE='20260823-223859'

scp dist/infinite-neck-$DEPLOY_DATE.tar.gz $SSH_LAR@demo.laramiecrocker.com:/home/laramiessh/sites/demo.laramiecrocker.com/

######### ON THE SERVER  ####################

ssh $SSH_LAR@demo.laramiecrocker.com

## Adjust the dates, and do something like: 

export DEPLOY_VERSION='v2.1-beta-12'
export DEPLOY_DATE='20260823-223859'

cd sites/demo.laramiecrocker.com
mkdir infinite-neck-deploy
cd infinite-neck-deploy
mv ../infinite-neck-$DEPLOY_DATE.tar.gz .
tar xvf infinite-neck-$DEPLOY_DATE.tar.gz
rm infinite-neck-$DEPLOY_DATE.tar.gz
cd ..
mv infinite-neck infinite-neck-$DEPLOY_VERSION; mv infinite-neck-deploy infinite-neck