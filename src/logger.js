const { EmbedBuilder } = require('discord.js');

function escapeMarkdown(value) {
  return String(value || '').replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1');
}

function truncate(value, maxLength = 1024) {
  if (!value) return 'None';
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function formatDisplayName(message) {
  return escapeMarkdown(message.member?.displayName || message.author?.username || message.author?.tag || 'Unknown user');
}

function formatActionSummary(actionResults) {
  const deleteText = actionResults.messageDeleted ? 'deleted' : 'delete failed';
  const timeoutText = actionResults.timeoutApplied
    ? `timeout ${actionResults.timeoutDays}d`
    : 'timeout failed';

  return `${deleteText} + ${timeoutText}`;
}

function formatReason(detection) {
  if (detection.mentionType === '@everyone') {
    return '@everyone + image + no text';
  }

  if (detection.mentionType === '@here') {
    return '@here + image + no text';
  }

  if (detection.mentionType === 'forced_role') {
    return 'forced mass role ping + image + no text';
  }

  if (detection.mentionType === 'mass_role') {
    return 'mass role ping + image + no text';
  }

  return truncate(detection.reason, 120);
}

function formatRoleLabel(detection) {
  if (detection.mentionedRoles.length > 0) {
    const role = detection.mentionedRoles[0];
    return `<@&${role.id}>`;
  }

  if (detection.mentionType === '@everyone' || detection.mentionType === '@here') {
    return detection.mentionType;
  }

  return 'None';
}

function formatCoverageValue(detection) {
  if (!detection.roleCoverage.length) return 'None';

  const coverage = detection.roleCoverage[0].coverage;
  return `${(coverage * 100).toFixed(0)}%`;
}

function formatErrors(errors) {
  if (!errors?.length) return null;

  const unique = [...new Set(errors)];
  return truncate(unique.join(' / '), 1024);
}

async function sendModLog(message, detection, context) {
  const {
    client,
    config,
    incidentCount,
    actionResults,
  } = context;
  const channel = await client.channels.fetch(config.modLogChannelId).catch(() => null);

  if (!channel || !channel.isTextBased()) {
    console.error('Could not send mod log: log channel was not found or is not text-based');
    return;
  }

  const filenames = [...message.attachments.values()]
    .map((attachment) => attachment.name)
    .filter(Boolean)
    .slice(0, 1)
    .join(', ');

  const profileUrl = `https://discord.com/users/${message.author.id}`;
  const descriptionLines = [
    `User: [${formatDisplayName(message)}](${profileUrl}) (\`${message.author.id}\`)`,
    `Action: ${formatActionSummary(actionResults)}`,
    `Reason: ${formatReason(detection)}`,
    `Channel: <#${message.channelId}>`,
  ];

  const fields = [
    {
      name: 'Role',
      value: formatRoleLabel(detection),
      inline: true,
    },
    {
      name: 'Coverage',
      value: formatCoverageValue(detection),
      inline: true,
    },
    {
      name: 'Images',
      value: String(detection.imageCount),
      inline: true,
    },
    {
      name: 'Incidents',
      value: String(incidentCount),
      inline: true,
    },
  ];

  const errorsValue = formatErrors(actionResults.errors);
  if (errorsValue) {
    fields.push({
      name: 'Errors',
      value: errorsValue,
      inline: false,
    });
  }

  if (config.debugLogDetails) {
    fields.push({
      name: 'Details',
      value: truncate(
        [
          `Mention: ${detection.mentionType}`,
          `Clean text: ${detection.cleanedTextLength}`,
          `File: ${filenames || 'None'}`,
        ].join(' | '),
      ),
      inline: false,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('\u{1F6A8} Image-Ping Spam Blocked')
    .setColor(0xd83a34)
    .setDescription(descriptionLines.join('\n'))
    .addFields(fields)
    .setTimestamp(new Date());

  await channel.send({ embeds: [embed] });
}

module.exports = {
  sendModLog,
};
