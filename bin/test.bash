export INFINITE_NECK_VERBOSE=-1
export INFINITE_NECK_SONGLIST=

clear

pushd ~/infinite-neck
node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --runInBand
popd

