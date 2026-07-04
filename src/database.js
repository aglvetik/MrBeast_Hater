const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const config = require('./config');

let db;

function initDatabase() {
  if (db) return db;

  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

  db = new Database(config.databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.prepare(`
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      action TEXT NOT NULL,
      image_count INTEGER NOT NULL,
      mentioned_roles TEXT,
      role_coverage TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  return db;
}

function saveIncident(incident) {
  const database = initDatabase();

  const result = database.prepare(`
    INSERT INTO incidents (
      guild_id,
      user_id,
      username,
      channel_id,
      message_id,
      reason,
      action,
      image_count,
      mentioned_roles,
      role_coverage,
      created_at
    ) VALUES (
      @guildId,
      @userId,
      @username,
      @channelId,
      @messageId,
      @reason,
      @action,
      @imageCount,
      @mentionedRoles,
      @roleCoverage,
      @createdAt
    )
  `).run({
    guildId: incident.guildId,
    userId: incident.userId,
    username: incident.username || null,
    channelId: incident.channelId,
    messageId: incident.messageId,
    reason: incident.reason,
    action: incident.action,
    imageCount: incident.imageCount,
    mentionedRoles: JSON.stringify(incident.mentionedRoles || []),
    roleCoverage: JSON.stringify(incident.roleCoverage || []),
    createdAt: incident.createdAt || new Date().toISOString(),
  });

  return result.lastInsertRowid;
}

function countUserIncidents(guildId, userId) {
  const database = initDatabase();

  const row = database.prepare(`
    SELECT COUNT(*) AS count
    FROM incidents
    WHERE guild_id = ? AND user_id = ?
  `).get(guildId, userId);

  return row.count;
}

module.exports = {
  initDatabase,
  saveIncident,
  countUserIncidents,
};
