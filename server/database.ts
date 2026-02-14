import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

// Open the database file
export const database = await open({
  filename: 'game.db',
  driver: sqlite3.Database,
})

export async function initializeDatabase() {
  await database.exec('PRAGMA journal_mode = WAL;')
  await database.exec('PRAGMA synchronous = NORMAL;')

  await database.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    room_id INTEGER PRIMARY KEY,
    room_code TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    player_1_name TEXT NOT NULL,
    player_2_name TEXT NOT NULL,
    player_1_secret TEXT,
    player_2_secret TEXT,
    room_state TEXT CHECK(json_valid(room_state))
  );
`)
}
