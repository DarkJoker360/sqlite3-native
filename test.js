const test = require('brittle')
const SQLite3 = require('.')
const { create } = require('./test/helpers')

const isBare = typeof Bare !== 'undefined'
const fs = isBare ? null : require('fs')
const os = isBare ? null : require('os')
const path = isBare ? null : require('path')

test('can open a db', async (t) => {
  const sql = create(t)
  await sql.exec('CREATE TABLE records (ID INTEGER PRIMARY KEY AUTOINCREMENT, NAME TEXT NOT NULL);')
  t.pass('opened the db without throwing')
})

test('can open a db and create many tables', async (t) => {
  const sql = create(t)

  for (let i = 0; i < 10; i++) {
    await sql.exec(
      `CREATE TABLE records${i} (ID INTEGER PRIMARY KEY AUTOINCREMENT, NAME TEXT NOT NULL);`
    )
  }

  t.pass('opened the db without throwing')
})

test('can open a db, insert and select', async (t) => {
  const sql = create(t)
  await sql.exec('CREATE TABLE records (ID INTEGER PRIMARY KEY AUTOINCREMENT, NAME TEXT NOT NULL);')
  await sql.exec("INSERT INTO records (NAME) values ('mathias'), ('andrew');")
  const result = await sql.exec('SELECT ID, NAME FROM records;')
  t.is(result.length, 2)
  t.alike(result[0].columns, ['ID', 'NAME'])
  t.alike(result[0].rows, ['1', 'mathias'])
  t.alike(result[1].rows, ['2', 'andrew'])
})

test('big values', async (t) => {
  const big = Buffer.alloc(4096).fill('big').toString()
  const sql = create(t)
  await sql.exec('CREATE TABLE records (ID INTEGER PRIMARY KEY AUTOINCREMENT, NAME TEXT NOT NULL);')
  await sql.exec("INSERT INTO records (NAME) values ('" + big + "'), ('short');")
  const result = await sql.exec('SELECT ID, NAME FROM records;')
  t.is(result.length, 2)
  t.alike(result[0].columns, ['ID', 'NAME'])
  t.alike(result[0].rows, ['1', big])
  t.alike(result[1].rows, ['2', 'short'])
})

test('basic index', async (t) => {
  const sql = create(t)

  await sql.exec('CREATE TABLE records (ID INTEGER PRIMARY KEY AUTOINCREMENT, NAME TEXT NOT NULL);')
  await sql.exec('CREATE UNIQUE INDEX idx_name ON records (NAME);')
  await sql.exec("INSERT INTO records (NAME) values ('mathias'), ('andrew');")
  const result = await sql.exec("SELECT NAME FROM records WHERE NAME = 'mathias';")
  t.is(result.length, 1)
  t.alike(result[0].columns, ['NAME'])
  t.alike(result[0].rows, ['mathias'])
})

test('bigger index', async (t) => {
  const sql = create(t)

  await sql.exec('CREATE TABLE records (ID INTEGER PRIMARY KEY AUTOINCREMENT, NAME TEXT NOT NULL);')
  await sql.exec('CREATE UNIQUE INDEX idx_name ON records (NAME);')

  for (let i = 0; i < 1000; i++) {
    await sql.exec(`INSERT INTO records (NAME) values ('mr-${i}');`)
  }

  const result = await sql.exec("SELECT NAME FROM records WHERE NAME = 'mr-10';")
  t.is(result.length, 1)
  t.alike(result[0].columns, ['NAME'])
  t.alike(result[0].rows, ['mr-10'])
})

test('prepared statements bind parameters safely', async (t) => {
  const sql = create(t)
  const unsafe = "mathias'); DROP TABLE records; --"

  await sql.exec('CREATE TABLE records (NAME TEXT NOT NULL);')

  const insert = await sql.prepare('INSERT INTO records (NAME) VALUES (?)')
  t.teardown(() => insert.finalize())
  await insert.run(unsafe)

  const select = await sql.prepare('SELECT NAME AS name FROM records WHERE NAME = ?')
  t.teardown(() => select.finalize())

  const row = await select.get(unsafe)
  t.alike(row, { name: unsafe })

  const stillThere = await sql.exec('SELECT NAME FROM records;')
  t.is(stillThere.length, 1)
})

test('prepared statement results preserve SQLite value types', async (t) => {
  const sql = create(t)

  await sql.exec('CREATE TABLE records (ID INTEGER, SCORE REAL, NAME TEXT, EMPTY TEXT);')

  const insert = await sql.prepare(
    'INSERT INTO records (ID, SCORE, NAME, EMPTY) VALUES (?, ?, ?, ?)'
  )
  t.teardown(() => insert.finalize())
  await insert.run(42, 13.5, 'typed', null)

  const select = await sql.prepare(
    'SELECT ID AS id, SCORE AS score, NAME AS name, EMPTY AS empty FROM records;'
  )
  t.teardown(() => select.finalize())

  const row = await select.get()
  t.alike(row, {
    id: 42,
    score: 13.5,
    name: 'typed',
    empty: null
  })
})

test('prepared statements round trip blobs as buffers', async (t) => {
  const sql = create(t)
  const embedding = Buffer.from([0, 1, 2, 3, 254, 255])

  await sql.exec('CREATE TABLE records (ID INTEGER PRIMARY KEY, EMBEDDING BLOB NOT NULL);')

  const insert = await sql.prepare('INSERT INTO records (ID, EMBEDDING) VALUES (?, ?)')
  t.teardown(() => insert.finalize())
  await insert.run(1, embedding)

  const select = await sql.prepare('SELECT EMBEDDING AS embedding FROM records WHERE ID = ?;')
  t.teardown(() => select.finalize())

  const row = await select.get(1)
  t.ok(Buffer.isBuffer(row.embedding))
  t.alike(row.embedding, embedding)
})

if (!isBare) {
  test('filename opens a durable database on disk', async (t) => {
    const filename = path.join(
      os.tmpdir(),
      `sqlite3-native-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
    )
    t.teardown(() => fs.rmSync(filename, { force: true }))

    const first = new SQLite3({ filename })
    await first.exec('CREATE TABLE records (NAME TEXT NOT NULL);')

    const insert = await first.prepare('INSERT INTO records (NAME) VALUES (?)')
    await insert.run('durable')
    await insert.finalize()
    await first.close()

    const second = new SQLite3({ filename })
    t.teardown(() => second.close())

    const select = await second.prepare('SELECT NAME AS name FROM records;')
    t.teardown(() => select.finalize())

    const row = await select.get()
    t.alike(row, { name: 'durable' })
  })
}
