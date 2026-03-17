#!/bin/bash


#node --experimental-vm-modules node_modules/.bin/jest "$@"
node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose
