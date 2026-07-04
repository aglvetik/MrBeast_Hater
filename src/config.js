const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config();

function parseIdList(value) {
  if (!value) return new Set();

  return new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function parseNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseInteger(value, fallback) {
  const parsed = Math.floor(parseNumber(value, fallback));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTimeoutDays(value) {
  const parsed = parseNumber(value, 28);
  return Math.max(1, Math.min(28, Math.floor(parsed)));
}

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

const config = {
  discordToken: required('DISCORD_TOKEN'),
  modLogChannelId: required('MOD_LOG_CHANNEL_ID'),
  timeoutDays: parseTimeoutDays(process.env.TIMEOUT_DAYS),
  massRoleThreshold: parseNumber(process.env.MASS_ROLE_THRESHOLD, 0.3),
  maxCleanTextLength: Math.max(0, Math.floor(parseNumber(process.env.MAX_CLEAN_TEXT_LENGTH, 20))),
  forcedMassRoleIds: parseIdList(process.env.FORCED_MASS_ROLE_IDS),
  bypassRoleIds: parseIdList(process.env.BYPASS_ROLE_IDS),
  ignoredChannelIds: parseIdList(process.env.IGNORED_CHANNEL_IDS),
  safeChannelIds: parseIdList(process.env.SAFE_CHANNEL_IDS),
  autoSafeChannels: parseBoolean(process.env.AUTO_SAFE_CHANNELS, false),
  autoSafeMaxWritersRatio: parseNumber(process.env.AUTO_SAFE_MAX_WRITERS_RATIO, 0.1),
  autoSafeMinMembersToCheck: Math.max(1, parseInteger(process.env.AUTO_SAFE_MIN_MEMBERS_TO_CHECK, 50)),
  autoSafeCacheTtlSeconds: Math.max(1, parseInteger(process.env.AUTO_SAFE_CACHE_TTL_SECONDS, 300)),
  debugSafeChannels: parseBoolean(process.env.DEBUG_SAFE_CHANNELS, false),
  debugRoleCoverage: parseBoolean(process.env.DEBUG_ROLE_COVERAGE, false),
  debugLogDetails: parseBoolean(process.env.DEBUG_LOG_DETAILS, false),
  memberFetchTtlSeconds: Math.max(1, parseInteger(process.env.MEMBER_FETCH_TTL_SECONDS, 300)),
  memberFetchCacheFullRatio: parseNumber(process.env.MEMBER_FETCH_CACHE_FULL_RATIO, 0.9),
  databasePath: path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/bot.sqlite'),
};

if (config.massRoleThreshold < 0 || config.massRoleThreshold > 1) {
  throw new Error('MASS_ROLE_THRESHOLD must be between 0 and 1');
}

if (config.autoSafeMaxWritersRatio < 0 || config.autoSafeMaxWritersRatio > 1) {
  throw new Error('AUTO_SAFE_MAX_WRITERS_RATIO must be between 0 and 1');
}

if (config.memberFetchCacheFullRatio < 0 || config.memberFetchCacheFullRatio > 1) {
  throw new Error('MEMBER_FETCH_CACHE_FULL_RATIO must be between 0 and 1');
}

module.exports = config;
