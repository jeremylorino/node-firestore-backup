"use strict";

const path = require('path'),
  fs = require('fs');
const client = require('../dist/index.js');

const backupDir = client.restore(path.resolve(__dirname, '../backup'));

// console.log(require(backupDir[0]));

// for(const d of backupDir) {
//   console.log(d);
// }
