/* @flow */

import Firebase from 'firebase-admin'

import fs from 'fs'
import path from 'path'
import mkdirp from 'mkdirp'
import flatMap from 'array.prototype.flatmap'
flatMap.shim()

import { FirestoreBackup } from './firestore'

export type BackupOptions = {|
  accountCredentials: string | Object,
  backupPath: string,
  databaseStartPath: string,
  prettyPrintJSON: boolean,
  requestCountLimit: number,
  exclude: Array<string>
|}

export default function(_options: BackupOptions) {
  const options = Object.assign({}, _options, { databaseStartPath: '' })

  let accountCredentialsContents: Object
  if (typeof options.accountCredentials === 'string') {
    try {
      const accountCredentialsBuffer = fs.readFileSync(options.accountCredentials)
      accountCredentialsContents = JSON.parse(accountCredentialsBuffer.toString())
    } catch (error) {
      throw new Error('Unable to read account credential file \'' + options.accountCredentials + '\': ' + error)
    }
  } else if (typeof options.accountCredentials === 'object') {
    accountCredentialsContents = options.accountCredentials
  } else {
    throw new Error('No account credentials provided')
  }

  Firebase.initializeApp({
    credential: Firebase.credential.cert(accountCredentialsContents)
  })

  try {
    mkdirp.sync(options.backupPath)
  } catch (error) {
    throw new Error('Unable to create backup path \'' + options.backupPath + '\': ' + error)
  }

  options.database = Firebase.firestore()
  const backupClient = new FirestoreBackup(options)
  return backupClient.backup()
}

import {
  isDocumentReference,
  isGeopoint,
  isString,
  isNull,
  isObject,
  isArray,
  isNumber,
  isDate,
  isBoolean
} from './types';

const TYPES = {
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
  const accountCredentialsContents = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  Firebase.initializeApp({
    credential: Firebase.credential.cert(accountCredentialsContents)
  })

  return Firebase.firestore()
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
const constructDocumentReference = (
  firestore: Object,
  referencePath: Object
): Object => {
  if (!firestore || !referencePath || !referencePath.segments) {
    return;
  }

  const segments = [...referencePath.segments];
  let docRef = firestore;

  while (segments.length) {
    const collectionName = segments.shift();
    const documentName = segments.shift();
    docRef = docRef.collection(collectionName).doc(documentName);
  }

  // Create proper instance of DocumentReference
  const documentReference = new Firebase.firestore.DocumentReference(
    firestore,
    docRef._referencePath
  );

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
const constructFirestoreDocumentObject = (
  documentData_: Object, { firestore, isArrayItem }: { firestore: Object, isArrayItem: Boolean } = {}
) => {
  if (!isObject(documentData_)) {
    console.warn(`Invalid documentData, ${documentData}, passed to
      constructFirestoreDocumentObject()`);
    return;
  }

  let documentDataToStore = {};
  let documentData = documentData_;
  let keys = Object.keys(documentData);
  if (isArrayItem) {
    // documentData was an array item, such as
    // { arrayName: [{name: 'fiona', type: 'string']}
    // and then called this function recursively with the first item, such as
    // {name: 'fiona', type: 'string'} so add a temporary key
    // to process it like the other field types
    documentData = { __arrayItem__: documentData };
    keys = Object.keys(documentData);
  }
  keys.forEach(key => {
    const { value, type } = documentData[key] || {};
    if (type === TYPES.BOOLEAN) {
      documentDataToStore = {
        ...documentDataToStore,
        [key]: value
      };
    } else if (type === TYPES.TIMESTAMP) {
      documentDataToStore = {
        ...documentDataToStore,
        [key]: new Date(value)
      };
    } else if (type === TYPES.NUMBER) {
      documentDataToStore = {
        ...documentDataToStore,
        [key]: value
      };
    } else if (type === TYPES.ARRAY) {
      const curVal = value || [];
      const childFieldObject = curVal.reduce(function(acc, cur) {
        const element = constructFirestoreDocumentObject(cur, {
          isArrayItem: true,
          firestore
        });
        acc.push(element.__arrayItem__);
        return acc;
      }, []);
      documentDataToStore = {
        ...documentDataToStore,
        [key]: childFieldObject
      };
    } else if (type === TYPES.OBJECT) {
      const curVal = documentData[key];
      const childFieldObject = Object.keys(curVal)
        .reduce(function(acc, cur, i) {
          if (cur !== "type") {
            const element = constructFirestoreDocumentObject({
              [cur]: curVal[cur]
            }, { firestore });
            acc[cur] = element[cur];
          }
          return acc;
        }, {});
      documentDataToStore = {
        ...documentDataToStore,
        [key]: childFieldObject
      };
    } else if (type === TYPES.NULL) {
      documentDataToStore = {
        ...documentDataToStore,
        [key]: null
      };
    } else if (type === TYPES.STRING) {
      documentDataToStore = {
        ...documentDataToStore,
        [key]: value
      };
    } else if (type === TYPES.DOCUMENT_REFERENCE) {
      if (!firestore) {
        let valueStr = value;
        try {
          valueStr = JSON.stringify(value);
        } catch (valueNotAnObjErr) {}
        console.error(`Cannot properly create DocumentReference
          without firestore credentials. Firestore is ${firestore}.
          Skipping field: ${valueStr}`);
      } else {
        const documentReference = constructDocumentReference(
          firestore, { segments: getSegments(value) }
        );
        documentDataToStore = {
          ...documentDataToStore,
          [key]: documentReference
        };
      }
    } else if (type === TYPES.GEOPOINT) {
      const geopoint = new Firebase.firestore.GeoPoint(
        value._latitude,
        value._longitude
      );
      documentDataToStore = {
        ...documentDataToStore,
        [key]: geopoint
      };
    } else {
      console.trace(
        `Unsupported type, ${type} from {${key}: ${value}} in ${JSON.stringify(
          documentData
        )}`
      );
    }
  });
  // Convert __arrayItem__ to an array
  return documentDataToStore;
};

function lsDirectory(dirPath: string) {
  if (fs.statSync(dirPath).isFile()) {
    return dirPath;
  }

  return fs.readdirSync(dirPath)
    .flatMap((f) => lsDirectory(path.resolve(dirPath, f)));
}

export const restore = (dirPath: string) => {
  const db = getDb();


  const lst = lsDirectory(dirPath);
  const documentDataValue = require(lst[0]);
  console.log(path.dirname(lst[0].replace(dirPath, '')));
  const documentData = constructFirestoreDocumentObject(
    documentDataValue, { firestore: db }
  );

  console.log(documentData);

  return lst;
};
