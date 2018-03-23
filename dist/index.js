'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.restore = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = function (_options) {
  var options = Object.assign({}, _options, { databaseStartPath: '' });

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

  try {
    _mkdirp2.default.sync(options.backupPath);
  } catch (error) {
    throw new Error('Unable to create backup path \'' + options.backupPath + '\': ' + error);
  }

  options.database = _firebaseAdmin2.default.firestore();
  var backupClient = new _firestore.FirestoreBackup(options);
  return backupClient.backup();
};

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

var _firestore = require('./firestore');

var _utility = require('./utility');

var _types = require('./types');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

_arrayPrototype2.default.shim();

var TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  OBJECT: 'object',
  ARRAY: 'array',
  NULL: 'null',
  TIMESTAMP: 'timestamp',
  GEOPOINT: 'geopoint',
  DOCUMENT_REFERENCE: 'reference'
};

function getDb() {
  var accountCredentialsContents = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  _firebaseAdmin2.default.initializeApp({
    credential: _firebaseAdmin2.default.credential.cert(accountCredentialsContents)
  });

  return _firebaseAdmin2.default.firestore();
}

/**
 * Create a DocumentReference instance without the _firestore field since
 * it does not need to be stored or used for restoring - The restore firestore
 * is used to change DocumentReference app partition to the restore database
 *
 * firestore is a FirebaseApp firestore instance
 * referencePath looks like:
 * "_referencePath": {
 *   "segments": ["CompanyCollection", "An7xh0LqvWDocumentId",
 *      "RoomsSubCollection", "conferenceRoom-001"],
 *   "_projectId": "backuprestore-f8687",
 *   "_databaseId": "(default)"
 * }
 */
var constructDocumentReference = function constructDocumentReference(firestore, referencePath) {
  if (!firestore || !referencePath || !referencePath.segments) {
    return;
  }

  var segments = [].concat(_toConsumableArray(referencePath.segments));
  var docRef = firestore;

  while (segments.length) {
    var collectionName = segments.shift();
    var documentName = segments.shift();
    docRef = docRef.collection(collectionName).doc(documentName);
  }

  // Create proper instance of DocumentReference
  var documentReference = new _firebaseAdmin2.default.firestore.DocumentReference(firestore, docRef._referencePath);

  // Remove _firestore field since it is not necessary
  delete documentReference._firestore;

  return documentReference;
};

/**
 * Object construction function to be stored on Firestore
 * For each document backup data object, is created an object ready to be stored
 * in firestore database.
 * Pass in firestore instance as second options parameter to properly
 * reconstruct DocumentReference values
 *
 * Example:
 * Backup Object Document
 * { name: { value: 'Jhon', type: 'string' }, age: { value: 26, type: 'number' }}
 * Object to be restored
 * { name: 'Jhon', age: 26 }
 * (see available types on FirestoreTypes file)
 */
var constructFirestoreDocumentObject = function constructFirestoreDocumentObject(documentData_) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
      firestore = _ref.firestore,
      isArrayItem = _ref.isArrayItem;

  if (!(0, _types.isObject)(documentData_)) {
    console.warn('Invalid documentData, ' + documentData + ', passed to\n      constructFirestoreDocumentObject()');
    return;
  }

  var documentDataToStore = {};
  var documentData = documentData_;
  var keys = Object.keys(documentData);
  if (isArrayItem) {
    // documentData was an array item, such as
    // { arrayName: [{name: 'fiona', type: 'string']}
    // and then called this function recursively with the first item, such as
    // {name: 'fiona', type: 'string'} so add a temporary key
    // to process it like the other field types
    documentData = { __arrayItem__: documentData };
    keys = Object.keys(documentData);
  }
  keys.forEach(function (key) {
    var _ref2 = documentData[key] || {},
        value = _ref2.value,
        type = _ref2.type;

    if (type === TYPES.BOOLEAN) {
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, value));
    } else if (type === TYPES.TIMESTAMP) {
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, new Date(value)));
    } else if (type === TYPES.NUMBER) {
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, value));
    } else if (type === TYPES.ARRAY) {
      var curVal = value || [];
      var childFieldObject = curVal.reduce(function (acc, cur) {
        var element = constructFirestoreDocumentObject(cur, {
          isArrayItem: true,
          firestore: firestore
        });
        acc.push(element.__arrayItem__);
        return acc;
      }, []);
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, childFieldObject));
    } else if (type === TYPES.OBJECT) {
      var _curVal = documentData[key];
      var _childFieldObject = Object.keys(_curVal).reduce(function (acc, cur, i) {
        if (cur !== "type") {
          var element = constructFirestoreDocumentObject(_defineProperty({}, cur, _curVal[cur]), { firestore: firestore });
          acc[cur] = element[cur];
        }
        return acc;
      }, {});
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, _childFieldObject));
    } else if (type === TYPES.NULL) {
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, null));
    } else if (type === TYPES.STRING) {
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, value));
    } else if (type === TYPES.DOCUMENT_REFERENCE) {
      if (!firestore) {
        var valueStr = value;
        try {
          valueStr = JSON.stringify(value);
        } catch (valueNotAnObjErr) {}
        console.error('Cannot properly create DocumentReference\n          without firestore credentials. Firestore is ' + firestore + '.\n          Skipping field: ' + valueStr);
      } else {
        var documentReference = constructDocumentReference(firestore, { segments: (0, _utility.getSegments)(value) });
        documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, documentReference));
      }
    } else if (type === TYPES.GEOPOINT) {
      var geopoint = new _firebaseAdmin2.default.firestore.GeoPoint(value._latitude, value._longitude);
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, geopoint));
    } else {
      console.trace('Unsupported type, ' + type + ' from {' + key + ': ' + value + '} in ' + JSON.stringify(documentData));
    }
  });
  // Convert __arrayItem__ to an array
  return documentDataToStore;
};

function lsDirectory(dirPath) {
  if (_fs2.default.statSync(dirPath).isFile()) {
    return dirPath;
  }

  return _fs2.default.readdirSync(dirPath).flatMap(function (f) {
    return lsDirectory(_path2.default.resolve(dirPath, f));
  });
}

var restore = exports.restore = function restore(dirPath) {
  var db = getDb();

  var lst = lsDirectory(dirPath);
  var documentDataValue = require(lst[0]);
  console.log(_path2.default.dirname(lst[0].replace(dirPath, '')));
  var documentData = constructFirestoreDocumentObject(documentDataValue, { firestore: db });

  console.log(documentData);

  return lst;
};