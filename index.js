const ReadyResource = require('ready-resource')
const binding = require('./binding')
const VFS = require('./lib/vfs')
const MemoryVFS = require('./lib/memory-vfs')
const constants = require('./lib/constants')

const STATEMENT_RUN = 0
const STATEMENT_ALL = 1
const STATEMENT_GET = 2

module.exports = exports = class SQLite3 extends ReadyResource {
  constructor(opts = {}) {
    const { filename, name = filename || 'sqlite3.db' } = opts
    const vfs = opts.vfs === undefined ? null : opts.vfs

    super()

    this.name = name

    this._vfs = vfs

    this._handle = binding.init(this)
  }

  async exec(query) {
    if (this.opened === false) await this.ready()

    return binding.exec(this._handle, query)
  }

  async prepare(query) {
    if (this.opened === false) await this.ready()

    return new Statement(this, await binding.prepare(this._handle, query))
  }

  async _open() {
    await binding.open(this._handle, this._vfs === null ? null : this._vfs._handle, this.name)
  }

  async _close() {
    if (this.opened) await binding.close(this._handle)

    if (this._vfs !== null) this._vfs.destroy()
  }
}

class Statement {
  constructor(db, handle) {
    this.db = db
    this._handle = handle
    this._finalized = false
    this._pending = Promise.resolve()
  }

  run(...params) {
    return this._exec(params, STATEMENT_RUN)
  }

  async all(...params) {
    return normalizeRows(await this._exec(params, STATEMENT_ALL))
  }

  async get(...params) {
    return normalizeRow(await this._exec(params, STATEMENT_GET))
  }

  finalize() {
    if (this._finalized) return this._pending

    this._finalized = true

    const pending = this._pending.then(() => binding.statementFinalize(this._handle))
    this._pending = pending.catch(noop)

    return pending
  }

  _exec(params, mode) {
    if (this._finalized) throw new Error('Statement has been finalized')

    const bound = params.map(normalizeParam)
    const pending = this._pending.then(() => binding.statementExec(this._handle, bound, mode))
    this._pending = pending.catch(noop)

    return pending
  }
}

function normalizeParam(value) {
  if (value === null || value === undefined) return null
  if (value instanceof ArrayBuffer) return value
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
  }
  return value
}

function normalizeRows(rows) {
  for (const row of rows) normalizeRow(row)
  return rows
}

function normalizeRow(row) {
  if (row === null) return null

  for (const key of Object.keys(row)) {
    if (row[key] instanceof ArrayBuffer) row[key] = Buffer.from(row[key])
  }

  return row
}

function noop() {}

exports.VFS = VFS
exports.MemoryVFS = MemoryVFS
exports.constants = constants
