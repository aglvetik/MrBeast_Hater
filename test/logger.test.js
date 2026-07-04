const test = require('node:test');
const assert = require('node:assert/strict');

const { sendModLog } = require('../src/logger');
const { createAttachment } = require('./helpers/mockDiscord');

function createLoggerContext(overrides = {}) {
  const sentPayloads = [];
  const channel = {
    isTextBased() {
      return true;
    },
    async send(payload) {
      sentPayloads.push(payload);
    },
  };

  const context = {
    client: {
      channels: {
        async fetch() {
          return channel;
        },
      },
    },
    config: {
      modLogChannelId: 'log-channel',
      debugLogDetails: false,
      ...overrides.config,
    },
    incidentCount: overrides.incidentCount ?? 9,
    actionResults: {
      messageDeleted: true,
      timeoutApplied: true,
      timeoutDays: 28,
      errors: [],
      ...overrides.actionResults,
    },
  };

  return {
    sentPayloads,
    context,
  };
}

function createMessage() {
  return {
    channelId: 'channel-1',
    author: {
      id: '1234567890',
      username: 'demo_user',
    },
    member: {
      displayName: 'Demo User',
    },
    attachments: new Map([
      ['0', createAttachment({ name: 'image.jpg' })],
    ]),
  };
}

function createDetection() {
  return {
    reason: 'Mass role mention: MassRole with 1 image attachment and no real text',
    mentionType: 'mass_role',
    mentionedRoles: [{ id: 'role-1', name: 'MassRole' }],
    roleCoverage: [{ coverage: 0.75 }],
    imageCount: 1,
    cleanedTextLength: 0,
  };
}

function getEmbed(sentPayloads) {
  return sentPayloads[0].embeds[0].data;
}

test('mod-log embed contains clickable Discord profile link', async () => {
  const { sentPayloads, context } = createLoggerContext();
  await sendModLog(createMessage(), createDetection(), context);

  const embed = getEmbed(sentPayloads);
  assert.match(embed.description, /https:\/\/discord\.com\/users\/1234567890/);
});

test('action text shows deleted + timeout 28d when both actions succeed', async () => {
  const { sentPayloads, context } = createLoggerContext({
    actionResults: {
      messageDeleted: true,
      timeoutApplied: true,
    },
  });

  await sendModLog(createMessage(), createDetection(), context);
  const embed = getEmbed(sentPayloads);

  assert.match(embed.description, /Action: deleted \+ timeout 28d/);
});

test('action text shows deleted + timeout failed when timeout fails', async () => {
  const { sentPayloads, context } = createLoggerContext({
    actionResults: {
      messageDeleted: true,
      timeoutApplied: false,
    },
  });

  await sendModLog(createMessage(), createDetection(), context);
  const embed = getEmbed(sentPayloads);

  assert.match(embed.description, /Action: deleted \+ timeout failed/);
});

test('DEBUG_LOG_DETAILS=false does not include filename sample', async () => {
  const { sentPayloads, context } = createLoggerContext({
    config: {
      debugLogDetails: false,
    },
  });

  await sendModLog(createMessage(), createDetection(), context);
  const embed = getEmbed(sentPayloads);

  assert.equal(embed.fields.some((field) => field.name === 'Details'), false);
});

test('DEBUG_LOG_DETAILS=true includes filename sample details', async () => {
  const { sentPayloads, context } = createLoggerContext({
    config: {
      debugLogDetails: true,
    },
  });

  await sendModLog(createMessage(), createDetection(), context);
  const embed = getEmbed(sentPayloads);
  const detailsField = embed.fields.find((field) => field.name === 'Details');

  assert.ok(detailsField);
  assert.match(detailsField.value, /File: image\.jpg/);
});
