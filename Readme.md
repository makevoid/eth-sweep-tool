# eth-sweep-tool

Status: alpha (code needs refactoring)

Main file: https://github.com/makevoid/eth-sweep-tool/blob/master/js/eth-sweep-tool.js

### Build tools

```
npm i -g browserify babelify
```

### Build

```
browserify js/eth-sweep-tool.js > js/dist/bundle.js
```

### Watch

```
watchify js/eth-sweep-tool.js -o js/dist/bundle.js
```
