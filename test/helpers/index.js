const SQLite3 = require('../..')

const isBare = typeof Bare !== 'undefined'
const fs = isBare ? null : require('fs')
const os = isBare ? null : require('os')
const path = isBare ? null : require('path')

let bareDatabaseCounter = 0

exports.create = function create(t) {
  const db = isBare ? createBare() : createNode(t)
  t.teardown(() => db.close())
  return db
}

function createBare() {
  return new SQLite3({ filename: createBareFilename() })
}

function createBareFilename() {
  const unique = `${Date.now()}-${bareDatabaseCounter++}-${Math.random().toString(16).slice(2)}`
  return `sqlite3-native-test-${unique}.db`
}

function createNode(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite3-native-test-'))
  const filename = path.join(directory, 'test.db')

  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }))

  return new SQLite3({ filename })
}
