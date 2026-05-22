#!/bin/bash


#node --experimental-vm-modules node_modules/.bin/jest "$@"
if [ "$#" -gt 0 ]; then
	node --experimental-vm-modules node_modules/.bin/jest "$@"
else
	node --experimental-vm-modules node_modules/.bin/jest _tests/jest/ --verbose
fi
