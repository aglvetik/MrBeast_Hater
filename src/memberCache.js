const lastFetchAt = new Map();
const inFlightFetch = new Map();
const retryUntil = new Map();

function getRetryAfterMs(error) {
  const retryAfterValues = [
    error?.retryAfter,
    error?.retry_after,
    error?.data?.retry_after,
    error?.rawError?.retry_after,
  ];

  for (const value of retryAfterValues) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) {
      return number < 1000 ? number * 1000 : number;
    }
  }

  const timeout = Number(error?.timeout);
  if (Number.isFinite(timeout) && timeout > 0) {
    return timeout;
  }

  return null;
}

function isRateLimitError(error) {
  return Boolean(
    getRetryAfterMs(error) !== null
      || error?.name === 'GatewayRateLimitError'
      || error?.status === 429,
  );
}

function buildResult(overrides) {
  return {
    ok: false,
    fetched: false,
    rateLimited: false,
    fromCache: false,
    cacheSize: 0,
    guildMemberCount: 0,
    retryUntil: null,
    error: null,
    ...overrides,
  };
}

async function ensureGuildMembers(guild, config, options = {}) {
  if (!guild?.members?.cache || typeof guild.members.fetch !== 'function') {
    return buildResult({
      error: 'guild_members_unavailable',
    });
  }

  const guildId = guild.id;
  const now = Date.now();
  const guildMemberCount = guild.memberCount || guild.members.cache.size;
  const cacheSize = guild.members.cache.size;
  const fullRatio = config.memberFetchCacheFullRatio;
  const ttlMs = config.memberFetchTtlSeconds * 1000;
  const fullEnough = guildMemberCount <= 0 || cacheSize >= guildMemberCount * fullRatio;
  const fetchedRecently = now - (lastFetchAt.get(guildId) || 0) < ttlMs;

  if (fullEnough || fetchedRecently) {
    return buildResult({
      ok: true,
      fromCache: true,
      cacheSize,
      guildMemberCount,
      retryUntil: retryUntil.get(guildId) || null,
    });
  }

  const inFlight = inFlightFetch.get(guildId);
  if (inFlight) {
    return inFlight;
  }

  const retryAt = retryUntil.get(guildId) || null;
  if (retryAt && now < retryAt) {
    return buildResult({
      ok: false,
      rateLimited: true,
      cacheSize,
      guildMemberCount,
      retryUntil: retryAt,
      error: `retry_later:${options.reason || 'guild-members'}`,
    });
  }

  const fetchPromise = guild.members.fetch()
    .then(() => {
      lastFetchAt.set(guildId, Date.now());
      retryUntil.delete(guildId);

      return buildResult({
        ok: true,
        fetched: true,
        cacheSize: guild.members.cache.size,
        guildMemberCount: guild.memberCount || guild.members.cache.size,
      });
    })
    .catch((error) => {
      const retryAfterMs = getRetryAfterMs(error);
      const limited = isRateLimitError(error);
      const nextRetryAt = limited && retryAfterMs ? Date.now() + retryAfterMs : null;

      if (nextRetryAt) {
        retryUntil.set(guildId, nextRetryAt);
      }

      return buildResult({
        ok: false,
        rateLimited: limited,
        cacheSize: guild.members.cache.size,
        guildMemberCount: guild.memberCount || guild.members.cache.size,
        retryUntil: nextRetryAt,
        error: error?.message || String(error),
      });
    })
    .finally(() => {
      inFlightFetch.delete(guildId);
    });

  inFlightFetch.set(guildId, fetchPromise);
  return fetchPromise;
}

module.exports = {
  ensureGuildMembers,
};
