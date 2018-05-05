/* @flow */

import Firebase from 'firebase-admin'

import fs from 'fs'
import path from 'path'
import mkdirp from 'mkdirp'
import flatMap from 'array.prototype.flatmap'
flatMap.shim()

import { FirestoreOptions, FirestoreBackupOptions, FirestoreRestoreOptions } from './types'

import { FirestoreBackup } from './firestore'
import { FirestoreRestore } from './restore'

function processOptions(_options: FirestoreOptions) {
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

  options.backupPath = path.resolve(options.backupPath)
  options.database = Firebase.firestore()
  return options
}

export const backup = (_options: FirestoreBackupOptions) => {
  const options = processOptions(_options)

  try {
    mkdirp.sync(options.backupPath)
  } catch (error) {
    throw new Error('Unable to create backup path \'' + options.backupPath + '\': ' + error)
  }

  const backupClient = new FirestoreBackup(options)
  return backupClient.backup()
}

export const restore = (_options: FirestoreRestoreOptions) => {
  const options = processOptions(_options)
  const client = new FirestoreRestore(options)
  return client.restore()
}
