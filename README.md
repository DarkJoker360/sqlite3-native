# sqlite3-native

Asynchronous SQLite3 bindings for JavaScript with VFS support.

```
npm i sqlite3-native
```

## Usage

```js
const SQLite3 = require('sqlite3-native')

const sql = new SQLite3()

await sql.exec(`CREATE TABLE records (NAME TEXT NOT NULL);`)

await sql.exec(`INSERT INTO records (NAME) values ('Jane'), ('John');`)

await sql.exec(`SELECT NAME FROM records;`)

// [
//   { rows: [ 'Jane' ], columns: [ 'NAME' ] },
//   { rows: [ 'John' ], columns: [ 'NAME' ] }
// ]
```

### Prepared statements

Use prepared statements for user input and values that should not be manually interpolated into SQL:

```js
const insert = await sql.prepare('INSERT INTO records (NAME) VALUES (?)')

await insert.run('Jane')
await insert.run('John')

await insert.finalize()
```

Statements expose `run()`, `get()`, `all()`, and `finalize()`:

```js
const select = await sql.prepare('SELECT NAME AS name FROM records WHERE NAME = ?')

const row = await select.get('Jane')

// { name: 'Jane' }

await select.finalize()
```

### Typed values and BLOBs

Prepared statement results preserve SQLite value types:

```js
await sql.exec('CREATE TABLE vectors (ID INTEGER, EMBEDDING BLOB, NOTE TEXT);')

const embedding = Buffer.from([0, 1, 2, 3])
const insertVector = await sql.prepare('INSERT INTO vectors VALUES (?, ?, ?)')

await insertVector.run(1, embedding, null)

const selectVector = await sql.prepare(
  'SELECT ID AS id, EMBEDDING AS embedding, NOTE AS note FROM vectors'
)
const vector = await selectVector.get()

// {
//   id: 1,
//   embedding: Buffer.from([0, 1, 2, 3]),
//   note: null
// }
```

Values can be bound as `null`, numbers, strings, `Buffer`, typed arrays, or `ArrayBuffer`.

### Durable files

By default, `new SQLite3()` uses SQLite's native file-backed storage and opens `sqlite3.db` in the current working directory. Pass `filename` to choose the database path:

```js
const defaultDb = new SQLite3()
const appDb = new SQLite3({ filename: 'qvac.db' })
const ragDb = new SQLite3({ filename: 'rag-vectors.db' })
```

Custom VFS implementations remain available for advanced use.

## License

Apache-2.0
