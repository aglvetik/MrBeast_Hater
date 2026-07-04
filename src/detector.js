const { ensureGuildMembers } = require('./memberCache');

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function isImageAttachment(attachment) {
  const contentType = attachment.contentType || '';
  if (contentType.toLowerCase().startsWith('image/')) return true;

  const filename = (attachment.name || '').toLowerCase();
  return [...IMAGE_EXTENSIONS].some((extension) => filename.endsWith(extension));
}

function cleanMessageText(content) {
  return (content || '')
    .replace(/<@&\d+>/g, '')
    .replace(/<@!?\d+>/g, '')
    .replace(/@everyone/g, '')
    .replace(/@here/g, '')
    .replace(/\s+/g, '');
}

function getHumanGuildMembers(guild) {
  return [...guild.members.cache.values()].filter((member) => !member.user?.bot);
}

function getRoleCoverageSnapshot(role, nonBotMembers, guildMemberCount) {
  const calculatedGuildMembers = nonBotMembers.length || guildMemberCount || 0;
  const calculatedRoleMembers = nonBotMembers.filter((member) => member.roles.cache.has(role.id)).length;
  const coverage = calculatedGuildMembers > 0 ? calculatedRoleMembers / calculatedGuildMembers : 0;

  return {
    roleMembersCacheCount: role.members.size,
    calculatedRoleMembers,
    calculatedGuildMembers,
    coverage,
  };
}

function logRoleCoverage(message, config, role, snapshot, forced, isMass, memberStatus) {
  if (!config.debugRoleCoverage) return;

  console.log(
    `[role-coverage] guild=${message.guild.id} channel=${message.channelId} role=${role.id} name="${role.name}" `
      + `roleMembersCacheCount=${snapshot.roleMembersCacheCount} calculatedRoleMembers=${snapshot.calculatedRoleMembers} `
      + `calculatedGuildMembers=${snapshot.calculatedGuildMembers} ratio=${snapshot.coverage.toFixed(4)} `
      + `threshold=${config.massRoleThreshold} forced=${forced} isMass=${isMass} `
      + `memberFetchOk=${memberStatus.ok} memberFetchRateLimited=${memberStatus.rateLimited} `
      + `memberFetchUsed=${memberStatus.fetched}`,
  );
}

async function getMassMentionInfo(message, config) {
  const mentionedRoles = [];
  const roleCoverage = [];

  if (message.mentions.everyone) {
    const mentionType = message.content.includes('@here') ? '@here' : '@everyone';
    return {
      hasMassMention: true,
      mentionType,
      mentionedRoles,
      roleCoverage,
      reason: `Mass mention: ${mentionType}`,
    };
  }

  const roles = [...message.mentions.roles.values()];
  if (roles.length === 0) {
    return {
      hasMassMention: false,
      mentionType: 'none',
      mentionedRoles,
      roleCoverage,
      reason: 'No mass mention',
    };
  }

  const forcedRole = roles.find((role) => config.forcedMassRoleIds.has(role.id));
  if (forcedRole) {
    const snapshot = getRoleCoverageSnapshot(forcedRole, getHumanGuildMembers(message.guild), message.guild.memberCount);
    const memberStatus = {
      ok: true,
      fetched: false,
      rateLimited: false,
    };

    logRoleCoverage(message, config, forcedRole, snapshot, true, true, memberStatus);

    mentionedRoles.push({
      id: forcedRole.id,
      name: forcedRole.name,
    });

    roleCoverage.push({
      id: forcedRole.id,
      name: forcedRole.name,
      coverage: snapshot.coverage,
      memberCount: snapshot.calculatedRoleMembers,
      guildMemberCount: snapshot.calculatedGuildMembers,
      cacheMemberCount: snapshot.roleMembersCacheCount,
      memberFetchOk: true,
      memberFetchRateLimited: false,
      membersFetchUsed: false,
      forced: true,
    });

    return {
      hasMassMention: true,
      mentionType: 'forced_role',
      mentionedRoles,
      roleCoverage,
      reason: `Forced mass role mention: ${forcedRole.name}`,
    };
  }

  const memberStatus = await ensureGuildMembers(message.guild, config, { reason: 'role-coverage' });
  const nonBotMembers = getHumanGuildMembers(message.guild);

  for (const role of roles) {
    const snapshot = getRoleCoverageSnapshot(role, nonBotMembers, message.guild.memberCount);
    const thresholdMatch = memberStatus.ok && snapshot.coverage >= config.massRoleThreshold;
    const isMass = thresholdMatch;

    logRoleCoverage(message, config, role, snapshot, false, isMass, memberStatus);

    mentionedRoles.push({
      id: role.id,
      name: role.name,
    });

    roleCoverage.push({
      id: role.id,
      name: role.name,
      coverage: snapshot.coverage,
      memberCount: snapshot.calculatedRoleMembers,
      guildMemberCount: snapshot.calculatedGuildMembers,
      cacheMemberCount: snapshot.roleMembersCacheCount,
      memberFetchOk: memberStatus.ok,
      memberFetchRateLimited: memberStatus.rateLimited,
      membersFetchUsed: memberStatus.fetched,
      forced: false,
    });

    if (isMass) {
      return {
        hasMassMention: true,
        mentionType: 'mass_role',
        mentionedRoles,
        roleCoverage,
        reason: `Mass role mention: ${role.name}`,
      };
    }
  }

  return {
    hasMassMention: false,
    mentionType: 'none',
    mentionedRoles,
    roleCoverage,
    reason: 'No mass mention',
  };
}

async function detectSpam(message, config) {
  const baseResult = {
    detected: false,
    reason: '',
    imageCount: 0,
    mentionType: 'none',
    mentionedRoles: [],
    roleCoverage: [],
    cleanedTextLength: 0,
  };

  if (message.author?.bot) {
    return { ...baseResult, reason: 'Bot message ignored' };
  }

  if (!message.guild || !message.member) {
    return { ...baseResult, reason: 'DM message ignored' };
  }

  if (message.guild.ownerId === message.author.id) {
    return { ...baseResult, reason: 'Guild owner ignored' };
  }

  if (config.ignoredChannelIds.has(message.channelId)) {
    return { ...baseResult, reason: 'Ignored channel' };
  }

  const hasBypassRole = message.member.roles.cache.some((role) => config.bypassRoleIds.has(role.id));
  if (hasBypassRole) {
    return { ...baseResult, reason: 'Bypass role' };
  }

  const images = [...message.attachments.values()].filter(isImageAttachment);
  const massMention = await getMassMentionInfo(message, config);
  const cleanedTextLength = cleanMessageText(message.content).length;

  const result = {
    ...baseResult,
    imageCount: images.length,
    mentionType: massMention.mentionType,
    mentionedRoles: massMention.mentionedRoles,
    roleCoverage: massMention.roleCoverage,
    cleanedTextLength,
    reason: massMention.reason,
  };

  if (!massMention.hasMassMention) {
    return result;
  }

  if (images.length === 0) {
    return { ...result, reason: 'Mass mention without image' };
  }

  if (cleanedTextLength > config.maxCleanTextLength) {
    return { ...result, reason: 'Message contains real text' };
  }

  return {
    ...result,
    detected: true,
    reason: `${massMention.reason} with ${images.length} image attachment${images.length === 1 ? '' : 's'} and no real text`,
  };
}

module.exports = {
  isImageAttachment,
  cleanMessageText,
  getMassMentionInfo,
  detectSpam,
};
