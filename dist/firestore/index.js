'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _backup = require('./backup');

Object.keys(_backup).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _backup[key];
    }
  });
});

var _restore = require('./restore');

Object.keys(_restore).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _restore[key];
    }
  });
});