export INFINITE_NECK_VERBOSE=3
clear

pushd ~/infinite-neck
node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose  --runInBand
popd
