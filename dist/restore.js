'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FirestoreRestore = exports.constructFirestoreDocumentObject = exports.constructDocumentReference = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _firebaseAdmin = require('firebase-admin');

var _firebaseAdmin2 = _interopRequireDefault(_firebaseAdmin);

var _utility = require('./utility');

var _types = require('./types');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

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
var constructDocumentReference = exports.constructDocumentReference = function constructDocumentReference(firestore, referencePath) {
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
var constructFirestoreDocumentObject = exports.constructFirestoreDocumentObject = function constructFirestoreDocumentObject(documentData_) {
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

    if (type === _types.TYPES.BOOLEAN) {
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, value));
    } else if (type === _types.TYPES.TIMESTAMP || type === _types.TYPES.DATE) {
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, new Date(value)));
    } else if (type === _types.TYPES.NUMBER) {
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, value));
    } else if (type === _types.TYPES.ARRAY) {
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
    } else if (type === _types.TYPES.OBJECT) {
      var _curVal = documentData[key];
      var _childFieldObject = Object.keys(_curVal).reduce(function (acc, cur, i) {
        if (cur !== "type") {
          var element = constructFirestoreDocumentObject(_defineProperty({}, cur, _curVal[cur]), { firestore: firestore });
          acc[cur] = element[cur];
        }
        return acc;
      }, {});
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, _childFieldObject));
    } else if (type === _types.TYPES.NULL) {
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, null));
    } else if (type === _types.TYPES.STRING) {
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, value));
    } else if (type === _types.TYPES.DOCUMENT_REFERENCE) {
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
    } else if (type === _types.TYPES.GEOPOINT) {
      var geopoint = new _firebaseAdmin2.default.firestore.GeoPoint(value._latitude, value._longitude);
      documentDataToStore = _extends({}, documentDataToStore, _defineProperty({}, key, geopoint));
    } else {
      console.trace('Unsupported type, ' + type + ' from {' + key + ': ' + value + '} in ' + JSON.stringify(documentData));
    }
  });
  // Convert __arrayItem__ to an array
  return documentDataToStore;
};

var defaultOptions = {
  databaseStartPath: '',
  requestCountLimit: 1,
  exclude: []
};

var FirestoreRestore = exports.FirestoreRestore = function () {
  function FirestoreRestore(options) {
    _classCallCheck(this, FirestoreRestore);

    this.options = Object.assign({}, defaultOptions, options);

    if (this.options.requestCountLimit > 1) {
      this.documentRequestLimit = 3; // 3 is the max before diminishing returns
    }
  }

  _createClass(FirestoreRestore, [{
    key: 'restore',
    value: function restore() {
      console.log('Starting restore...');
      if (this.options.databaseStartPath) {
        console.log('Using start path \'', this.options.databaseStartPath, '\'');
      }
      if (this.options.exclude && this.options.exclude.length > 0) {
        console.log('Excluding ', this.options.exclude);
      }

      /*if (isDocumentPath(this.options.databaseStartPath)) {
        const databaseDocument = this.options.database.doc(this.options.databaseStartPath)
        return databaseDocument.get()
          .then((document) => {
            return this.backupDocument(document, this.options.backupPath + '/' + document.ref.path, '/')
          })
      }
       if (isCollectionPath(this.options.databaseStartPath)) {
        const databaseCollection = this.options.database.collection(this.options.databaseStartPath)
        return this.backupCollection(databaseCollection, this.options.backupPath + '/' + databaseCollection.path, '/')
      }*/

      return this.restoreFromPath(this.options.backupPath);
    }
  }, {
    key: 'lsDirectory',
    value: function lsDirectory(dirPath) {
      var _this = this;

      if (_fs2.default.statSync(dirPath).isFile()) {
        return dirPath;
      }

      return _fs2.default.readdirSync(dirPath).flatMap(function (f) {
        return _this.lsDirectory(_path2.default.resolve(dirPath, f));
      });
    }
  }, {
    key: 'restoreFromPath',
    value: function restoreFromPath(dirPath) {
      var _this2 = this;

      console.time('lsDirectory');
      var lst = this.lsDirectory(dirPath).filter(function (f) {
        return f.startsWith(dirPath + '/users');
      });
      console.timeEnd('lsDirectory');

      return (0, _utility.promiseParallel)(lst, function (docFilePath) {
        var documentDataValue = require(docFilePath);
        var documentIdPath = _path2.default.dirname(docFilePath.replace(dirPath, ''));
        console.log(documentIdPath);

        var documentData = constructFirestoreDocumentObject(documentDataValue, { firestore: _this2.options.database });

        return _this2.options.database.doc(documentIdPath).set(documentData);
      }, this.options.requestCountLimit);
    }
  }]);

  return FirestoreRestore;
}();