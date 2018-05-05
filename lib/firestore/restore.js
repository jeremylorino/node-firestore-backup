/* @flow */

import fs from 'fs'
import path from 'path'
import Firebase from 'firebase-admin'

import { getSegments, promiseParallel } from './utility'
import {
  TYPES,
  isDocumentReference,
  isGeopoint,
  isString,
  isNull,
  isObject,
  isArray,
  isNumber,
  isDate,
  isBoolean
} from '../types'
import type { FirestoreRestoreOptions } from '../types'

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
export const constructDocumentReference = (
  firestore: Object,
  referencePath: Object
): Object => {
  if (!firestore || !referencePath || !referencePath.segments) {
    return
  }

  const segments = [...referencePath.segments]
  let docRef = firestore

  while (segments.length) {
    const collectionName = segments.shift()
    const documentName = segments.shift()
    docRef = docRef.collection(collectionName).doc(documentName)
  }

  // Create proper instance of DocumentReference
  const documentReference = new Firebase.firestore.DocumentReference(
    firestore,
    docRef._referencePath
  )

  // Remove _firestore field since it is not necessary
  delete documentReference._firestore

  return documentReference
}

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
export const constructFirestoreDocumentObject = (
  documentData_: Object, { firestore, isArrayItem }: { firestore: Object, isArrayItem: Boolean } = {}
) => {
  if (!isObject(documentData_)) {
    console.warn(`Invalid documentData, ${documentData}, passed to
      constructFirestoreDocumentObject()`)
    return
  }

  let documentDataToStore = {}
  let documentData = documentData_
  let keys = Object.keys(documentData)
  if (isArrayItem) {
    // documentData was an array item, such as
    // { arrayName: [{name: 'fiona', type: 'string']}
    // and then called this function recursively with the first item, such as
    // {name: 'fiona', type: 'string'} so add a temporary key
    // to process it like the other field types
    documentData = { __arrayItem__: documentData }
    keys = Object.keys(documentData)
  }
  keys.forEach(key => {
    const { value, type } = documentData[key] || {}
    if (type === TYPES.BOOLEAN) {
      documentDataToStore = {
        ...documentDataToStore,
        [key]: value
      }
    } else if (type === TYPES.TIMESTAMP || type === TYPES.DATE) {
      documentDataToStore = {
        ...documentDataToStore,
        [key]: new Date(value)
      }
    } else if (type === TYPES.NUMBER) {
      documentDataToStore = {
        ...documentDataToStore,
        [key]: value
      }
    } else if (type === TYPES.ARRAY) {
      const curVal = value || []
      const childFieldObject = curVal.reduce(function(acc, cur) {
        const element = constructFirestoreDocumentObject(cur, {
          isArrayItem: true,
          firestore
        })
        acc.push(element.__arrayItem__)
        return acc
      }, [])
      documentDataToStore = {
        ...documentDataToStore,
        [key]: childFieldObject
      }
    } else if (type === TYPES.OBJECT) {
      const curVal = documentData[key]
      const childFieldObject = Object.keys(curVal)
        .reduce(function(acc, cur, i) {
          if (cur !== "type") {
            const element = constructFirestoreDocumentObject({
              [cur]: curVal[cur]
            }, { firestore })
            acc[cur] = element[cur]
          }
          return acc
        }, {})
      documentDataToStore = {
        ...documentDataToStore,
        [key]: childFieldObject
      }
    } else if (type === TYPES.NULL) {
      documentDataToStore = {
        ...documentDataToStore,
        [key]: null
      }
    } else if (type === TYPES.STRING) {
      documentDataToStore = {
        ...documentDataToStore,
        [key]: value
      }
    } else if (type === TYPES.DOCUMENT_REFERENCE) {
      if (!firestore) {
        let valueStr = value
        try {
          valueStr = JSON.stringify(value)
        } catch (valueNotAnObjErr) {}
        console.error(`Cannot properly create DocumentReference
          without firestore credentials. Firestore is ${firestore}.
          Skipping field: ${valueStr}`)
      } else {
        const documentReference = constructDocumentReference(
          firestore, { segments: getSegments(value) }
        )
        documentDataToStore = {
          ...documentDataToStore,
          [key]: documentReference
        }
      }
    } else if (type === TYPES.GEOPOINT) {
      const geopoint = new Firebase.firestore.GeoPoint(
        value._latitude,
        value._longitude
      )
      documentDataToStore = {
        ...documentDataToStore,
        [key]: geopoint
      }
    } else {
      console.trace(
        `Unsupported type, ${type} from {${key}: ${value}} in ${JSON.stringify(
          documentData
        )}`
      )
    }
  })
  // Convert __arrayItem__ to an array
  return documentDataToStore
}

const defaultOptions = {
  databaseStartPath: '',
  requestCountLimit: 1,
  exclude: []
}

export class FirestoreRestore {
  options: FirestoreRestoreOptions;

  documentRequestLimit: number;

  constructor(options: FirestoreRestoreOptions) {
    this.options = Object.assign({}, defaultOptions, options)

    if (this.options.requestCountLimit > 1) {
      this.documentRequestLimit = 3 // 3 is the max before diminishing returns
    }
  }

  restore() {
    console.log('Starting restore...')
    if (this.options.databaseStartPath) {
      console.log('Using start path \'', this.options.databaseStartPath, '\'')
    }
    if (this.options.exclude && this.options.exclude.length > 0) {
      console.log('Excluding ', this.options.exclude)
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

    return this.restoreFromPath(this.options.backupPath)
  }

  lsDirectory(dirPath: string) {
    if (fs.statSync(dirPath).isFile()) {
      return dirPath
    }

    return fs.readdirSync(dirPath)
      .flatMap((f) => this.lsDirectory(path.resolve(dirPath, f)))
  }

  restoreFromPath(dirPath: string) {
    console.time('lsDirectory')
    const lst = this.lsDirectory(dirPath)
      .filter(f => f.startsWith(`${dirPath}/users`))
    console.timeEnd('lsDirectory')

    return promiseParallel(lst, (docFilePath) => {
      const documentDataValue = require(docFilePath)
      const documentIdPath = path.dirname(docFilePath.replace(dirPath, ''))
      console.log(documentIdPath)

      const documentData = constructFirestoreDocumentObject(
        documentDataValue, { firestore: this.options.database }
      )

      return this.options.database.doc(documentIdPath).set(documentData)
    }, this.options.requestCountLimit)
  }
}
