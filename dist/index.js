'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.restore = exports.backup = exports.FirestoreRestore = exports.FirestoreBackup = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _firebaseAdmin = require('firebase-admin');

var _firebaseAdmin2 = _interopRequireDefault(_firebaseAdmin);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _arrayPrototype = require('array.prototype.flatmap');

var _arrayPrototype2 = _interopRequireDefault(_arrayPrototype);

var _types = require('./types');

var _firestore = require('./firestore');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_arrayPrototype2.default.shim();

exports.FirestoreBackup = _firestore.FirestoreBackup;
exports.FirestoreRestore = _firestore.FirestoreRestore;


function processOptions(_options) {
  var options = Object.assign({ databaseStartPath: '' }, _options);

  var accountCredentialsContents = void 0;
  if (typeof options.accountCredentials === 'string') {
    try {
      var accountCredentialsBuffer = _fs2.default.readFileSync(options.accountCredentials);
      accountCredentialsContents = JSON.parse(accountCredentialsBuffer.toString());
    } catch (error) {
      throw new Error('Unable to read account credential file \'' + options.accountCredentials + '\': ' + error);
    }
  } else if (_typeof(options.accountCredentials) === 'object') {
    accountCredentialsContents = options.accountCredentials;
  } else {
    throw new Error('No account credentials provided');
  }

  _firebaseAdmin2.default.initializeApp({
    credential: _firebaseAdmin2.default.credential.cert(accountCredentialsContents)
  });

  options.backupPath = _path2.default.resolve(options.backupPath);
  options.database = _firebaseAdmin2.default.firestore();
  return options;
}

var backup = exports.backup = function backup(_options) {
  var options = processOptions(_options);

  try {
    _mkdirp2.default.sync(options.backupPath);
  } catch (error) {
    throw new Error('Unable to create backup path \'' + options.backupPath + '\': ' + error);
  }

  var backupClient = new _firestore.FirestoreBackup(options);
  return backupClient.backup();
};

var restore = exports.restore = function restore(_options) {
  var options = processOptions(_options);
  var client = new _firestore.FirestoreRestore(options);
  return client.restore();
};