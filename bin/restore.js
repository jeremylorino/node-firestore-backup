#!/usr/bin/env node

/* @flow */

/*require('@google-cloud/profiler').start({
  projectId: 'jal-events',
  serviceContext: {
    service: 'firestore-backup',
    version: '2.2.0'
  },
  logLevel: 4,
  timeIntervalMicros: 10
});*/

const commander = require('commander')
const colors = require('colors')

// $FlowFixMe - TODO: 'process' is available in node, look into why this is failing
const process = require('process')
const fs = require('fs')

const accountCredentialsPathParamKey = 'accountCredentials'
const accountCredentialsPathParamDescription = 'Google Cloud account credentials JSON file'

const backupPathParamKey = 'backupPath'
const backupPathParamDescription = 'Path to backup to be restored.'

const prettyPrintParamKey = 'prettyPrint'
const prettyPrintParamDescription = 'JSON backups done with pretty-printing.'

const databaseStartPathParamKey = 'databaseStartPath'
const databaseStartPathParamDescription = 'The database collection or document path to begin backup.'

const requestCountLimitParamKey = 'requestCountLimit'
const requestCountLimitParamDescription = 'The maximum number of requests to be made in parallel.'

const excludeParamKey = 'excludeCollections'
const excludeParamDescription = 'Collection id(s) to exclude from backing up.'

const collectAllValues = (addValue/*: string */, toValues/*: Array<string> */)/*: Array<string> */ => {
  toValues.push(addValue)
  return toValues
}

commander.version('2.2.0')
  .option('-a, --' + accountCredentialsPathParamKey + ' <path>', accountCredentialsPathParamDescription)
  .option('-B, --' + backupPathParamKey + ' <path>', backupPathParamDescription)
  .option('-P, --' + prettyPrintParamKey, prettyPrintParamDescription)
  .option('-S, --' + databaseStartPathParamKey + ' <path>', databaseStartPathParamDescription)
  .option('-L, --' + requestCountLimitParamKey + ' <number>', requestCountLimitParamDescription)
  .option('-E, --' + excludeParamKey + ' <path>', excludeParamDescription, collectAllValues, [])
  .parse(process.argv)

const accountCredentialsPath = commander[accountCredentialsPathParamKey]
if (!accountCredentialsPath) {
  console.log(colors.bold(colors.red('Missing: ')) + colors.bold(accountCredentialsPathParamKey) + ' - ' + accountCredentialsPathParamDescription)
  commander.help()
  process.exit(1)
}

if (!fs.existsSync(accountCredentialsPath)) {
  console.log(colors.bold(colors.red('Account credentials file does not exist: ')) + colors.bold(accountCredentialsPath))
  commander.help()
  process.exit(1)
}

const backupPath = commander[backupPathParamKey]
if (!backupPath) {
  console.log(colors.bold(colors.red('Missing: ')) + colors.bold(backupPathParamKey) + ' - ' + backupPathParamDescription)
  commander.help()
  process.exit(1)
}

const prettyPrintJSON = commander[prettyPrintParamKey] !== undefined && commander[prettyPrintParamKey] !== null

const databaseStartPath = (commander[databaseStartPathParamKey] || '').replace(/^\//, '')

const requestCountLimit = parseInt(commander[requestCountLimitParamKey] || '1', 10)

const exclude = commander[excludeParamKey] || []

const client = require('../dist/index.js');

try {
  console.time('restoretime')
  client.restore({
    accountCredentials: accountCredentialsPath,
    databaseStartPath,
    backupPath,
    prettyPrintJSON,
    requestCountLimit,
    exclude
  })
    .then(() => {
      console.log(colors.bold(colors.green('All done 💫')))
      console.timeEnd('restoretime')
    })
} catch (error) {
  console.log(colors.red(error))
  console.timeEnd('restoretime')
  process.exit(1)
}
