const { PermissionFlagsBits } = require('discord.js');
const { ensureGuildMembers } = require('./memberCache');

const safetyCache = new Map();

function getChannelId(message) {
  return message.channel?.id || message.channelId;
}

function getCacheKey(message) {
  return `${message.guild.id}:${getChannelId(message)}`;
}

function getNonBotMembers(guild) {
  return [...guild.members.cache.values()].filter((member) => !member.user?.bot);
}

function isSupportedChannel(message) {
  const channel = message.channel;

  return Boolean(
    message.guild
      && channel
      && typeof channel.isTextBased === 'function'
      && channel.isTextBased()
      && typeof channel.permissionsFor === 'function',
  );
}

function canMemberSendInChannel(channel, member) {
  return channel.permissionsFor(member)?.has(PermissionFlagsBits.SendMessages) || false;
}

function createResult(overrides) {
  return {
    safe: false,
    reason: 'not_safe',
    checkedMembers: 0,
    writers: 0,
    ratio: null,
    memberFetchOk: true,
    memberFetchRateLimited: false,
    ...overrides,
  };
}

function debugLog(message, config, result) {
  if (!config.debugSafeChannels) return;

  const ratioText = typeof result.ratio === 'number' ? result.ratio.toFixed(4) : 'n/a';

  console.log(
    `[safe-channel] guild=${message.guild?.id || 'none'} channel=${getChannelId(message) || 'unknown'} `
      + `safe=${result.safe} reason=${result.reason} checkedMembers=${result.checkedMembers} `
      + `writers=${result.writers} ratio=${ratioText} threshold=${config.autoSafeMaxWritersRatio} `
      + `memberFetchOk=${result.memberFetchOk} rateLimited=${result.memberFetchRateLimited}`,
  );
}

function withDebug(message, config, result) {
  debugLog(message, config, result);
  return result;
}

function getCachedResult(message) {
  const cached = safetyCache.get(getCacheKey(message));
  if (!cached || cached.expiresAt <= Date.now()) {
    return null;
  }

  return createResult(cached);
}

function cacheResult(message, config, result) {
  safetyCache.set(getCacheKey(message), {
    ...result,
    expiresAt: Date.now() + config.autoSafeCacheTtlSeconds * 1000,
  });

  return result;
}

async function isSafeChannel(message, config) {
  const channelId = getChannelId(message);

  if (config.safeChannelIds.has(channelId)) {
    return withDebug(message, config, createResult({
      safe: true,
      reason: 'manual_safe_channel',
    }));
  }

  if (!config.autoSafeChannels) {
    return withDebug(message, config, createResult({
      reason: 'auto_safe_disabled',
    }));
  }

  if (!isSupportedChannel(message)) {
    return withDebug(message, config, createResult({
      reason: 'unsupported_channel_type',
    }));
  }

  const cached = getCachedResult(message);
  if (cached) {
    return withDebug(message, config, cached);
  }

  const memberStatus = await ensureGuildMembers(message.guild, config, { reason: 'safe-channel' });
  const nonBotMembers = getNonBotMembers(message.guild);
  const checkedMembers = nonBotMembers.length;

  if (!memberStatus.ok) {
    let writers = 0;

    for (const member of nonBotMembers) {
      if (canMemberSendInChannel(message.channel, member)) {
        writers += 1;
      }
    }

    return withDebug(message, config, createResult({
      reason: memberStatus.rateLimited ? 'member_fetch_rate_limited' : 'member_fetch_failed',
      checkedMembers,
      writers,
      ratio: checkedMembers > 0 ? writers / checkedMembers : null,
      memberFetchOk: false,
      memberFetchRateLimited: memberStatus.rateLimited,
    }));
  }

  let writers = 0;

  for (const member of nonBotMembers) {
    if (canMemberSendInChannel(message.channel, member)) {
      writers += 1;
    }
  }

  if (checkedMembers < config.autoSafeMinMembersToCheck) {
    return withDebug(message, config, cacheResult(message, config, createResult({
      reason: 'not_enough_members_checked',
      checkedMembers,
      writers,
      ratio: checkedMembers > 0 ? writers / checkedMembers : null,
    })));
  }

  const ratio = checkedMembers > 0 ? writers / checkedMembers : null;
  const safe = ratio !== null && ratio <= config.autoSafeMaxWritersRatio;

  return withDebug(message, config, cacheResult(message, config, createResult({
    safe,
    reason: safe ? 'auto_safe_channel' : 'not_safe',
    checkedMembers,
    writers,
    ratio,
  })));
}

module.exports = {
  canMemberSendInChannel,
  isSafeChannel,
};
