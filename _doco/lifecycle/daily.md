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
