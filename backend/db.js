const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs   = require("fs");

const DB_PATH     = process.env.DB_PATH     || path.join(__dirname, "..", "database", "trends.db");
const SCHEMA_PATH = path.join(__dirname, "..", "database", "schema.sql");

let db;

function getDb() {
  if (!db) {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA synchronous = NORMAL");
    console.log(`[DB] Connected to ${DB_PATH}`);
  }
  return db;
}

function initDb() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`[DB] Schema not found at ${SCHEMA_PATH}`);
    return false;
  }
  getDb().exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  console.log("[DB] Schema applied");
  return true;
}

const plain = (row) => row ? Object.assign({}, row) : row;

function all(sql, params = []) {
  return getDb().prepare(sql).all(...params).map(plain);
}

function get(sql, params = []) {
  return plain(getDb().prepare(sql).get(...params));
}

function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

function insertMany(sql, rows) {
  const database = getDb();
  const stmt     = database.prepare(sql);
  database.exec("BEGIN");
  try {
    for (const row of rows) stmt.run(row);
    database.exec("COMMIT");
  } catch (e) {
    database.exec("ROLLBACK");
    throw e;
  }
}

module.exports = { getDb, initDb, all, get, run, insertMany };
