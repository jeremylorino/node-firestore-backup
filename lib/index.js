/* @flow */

import Firebase from 'firebase-admin'

import fs from 'fs'
import mkdirp from 'mkdirp'

import { FirestoreBackup } from './firestore'
import type { BackupOptions } from './types'

export default function(_options: BackupOptions) {
  const options = Object.assign({}, _options, {databaseStartPath: ''})

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
