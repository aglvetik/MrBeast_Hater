const { sendModLog } = require('./logger');

function timeoutMs(days) {
  return days * 24 * 60 * 60 * 1000;
}

async function handleDetectedSpam(message, detection, context) {
  const { config, database } = context;
  const actionResults = {
    messageDeleted: false,
    timeoutApplied: false,
    timeoutDays: config.timeoutDays,
    errors: [],
  };

  function addActionError(error) {
    const rawMessage = error?.message || error?.rawError?.message || String(error);
    const compactMessage = rawMessage.replace(/\s+/g, ' ').trim();

    if (compactMessage && !actionResults.errors.includes(compactMessage)) {
      actionResults.errors.push(compactMessage);
    }
  }

  try {
    await message.delete();
    actionResults.messageDeleted = true;
  } catch (error) {
    console.error(`Failed to delete message ${message.id}: ${error?.message || String(error)}`);
    addActionError(error);
  }

  try {
    await message.member.timeout(timeoutMs(config.timeoutDays), detection.reason);
    actionResults.timeoutApplied = true;
  } catch (error) {
    console.error(`Failed to timeout user ${message.author.id}: ${error?.message || String(error)}`);
    addActionError(error);
  }

  const previousIncidentCount = database.countUserIncidents(message.guild.id, message.author.id);
  let incidentCount = previousIncidentCount;

  try {
    database.saveIncident({
      guildId: message.guild.id,
      userId: message.author.id,
      username: message.author.tag,
      channelId: message.channelId,
      messageId: message.id,
      reason: detection.reason,
      action: [
        actionResults.messageDeleted ? 'message_deleted' : 'message_delete_failed',
        actionResults.timeoutApplied ? `timeout_${config.timeoutDays}_days` : 'timeout_failed',
      ].join(','),
      imageCount: detection.imageCount,
      mentionedRoles: detection.mentionedRoles,
      roleCoverage: detection.roleCoverage,
      createdAt: new Date().toISOString(),
    });
    incidentCount += 1;
  } catch (error) {
    console.error(`Failed to save incident for ${message.author.id}: ${error?.message || String(error)}`);
  }

  try {
    await sendModLog(message, detection, {
      ...context,
      incidentCount,
      actionResults,
    });
  } catch (error) {
    console.error(`Failed to send moderation log for message ${message.id}: ${error?.message || String(error)}`);
  }
}

module.exports = {
  handleDetectedSpam,
};
