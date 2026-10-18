/* Opens the SQLite database file and creates the tables if they don't exist yet. */

const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "campusdesk.db"));

// SQLite ignores foreign keys unless this is switched on
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS subjects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    min_percent INTEGER NOT NULL DEFAULT 75,
    days        TEXT    NOT NULL DEFAULT '',      -- weekday numbers, e.g. '1,2,3' (0 = Sunday)
    attended    INTEGER NOT NULL DEFAULT 0,
    total       INTEGER NOT NULL DEFAULT 0
  );

  -- One row per subject per day, so a day can only be marked once
  CREATE TABLE IF NOT EXISTS attendance_log (
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    date       TEXT    NOT NULL,                   -- 'YYYY-MM-DD'
    status     TEXT    NOT NULL CHECK (status IN ('present', 'absent')),
    PRIMARY KEY (subject_id, date)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    amount   REAL NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL,
    date     TEXT NOT NULL,
    note     TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    deadline     TEXT    NOT NULL DEFAULT '',
    column_index INTEGER NOT NULL DEFAULT 0 CHECK (column_index BETWEEN 0 AND 2),
    completed_on TEXT    NOT NULL DEFAULT ''
  );
`);

module.exports = db;
