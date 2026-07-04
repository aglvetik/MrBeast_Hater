const test = require('node:test');
const assert = require('node:assert/strict');

const { isSafeChannel } = require('../src/channelSafety');
const {
  createChannel,
  createGuild,
  createMember,
  createMessage,
} = require('./helpers/mockDiscord');

function createConfig(overrides = {}) {
  return {
    safeChannelIds: new Set(),
    autoSafeChannels: true,
    autoSafeMaxWritersRatio: 0.3,
    autoSafeMinMembersToCheck: 1,
    autoSafeCacheTtlSeconds: 300,
    debugSafeChannels: false,
    memberFetchTtlSeconds: 300,
    memberFetchCacheFullRatio: 0.9,
    ...overrides,
  };
}

function createFiveMemberGuild(options = {}) {
  const members = [
    createMember({ id: 'u1' }),
    createMember({ id: 'u2' }),
    createMember({ id: 'u3' }),
    createMember({ id: 'u4' }),
    createMember({ id: 'u5' }),
  ];

  return createGuild({
    initialMembers: options.initialMembers || members,
    fetchedMembers: members,
    memberCount: 5,
    ...options,
  });
}

test('manual safe channel returns safe true with manual_safe_channel', async () => {
  const guild = createFiveMemberGuild();
  const channel = createChannel({ id: 'manual-safe', writableMemberIds: ['u1'] });
  const message = createMessage({ guild, channel, content: '@everyone', mentionEveryone: true });

  const result = await isSafeChannel(message, createConfig({
    safeChannelIds: new Set(['manual-safe']),
  }));

  assert.equal(result.safe, true);
  assert.equal(result.reason, 'manual_safe_channel');
});

test('auto-safe returns safe true for 1 writer out of 5 at threshold 0.30', async () => {
  const guild = createFiveMemberGuild({
    initialMembers: [createMember({ id: 'seed' })],
  });
  const channel = createChannel({ writableMemberIds: ['u1'] });
  const message = createMessage({ guild, channel });

  const result = await isSafeChannel(message, createConfig({
    autoSafeMaxWritersRatio: 0.3,
    autoSafeMinMembersToCheck: 1,
  }));

  assert.equal(result.safe, true);
  assert.equal(result.reason, 'auto_safe_channel');
  assert.equal(result.checkedMembers, 5);
  assert.equal(result.writers, 1);
  assert.equal(result.ratio, 0.2);
});

test('not safe returns safe false when 4 of 5 members can write', async () => {
  const guild = createFiveMemberGuild();
  const channel = createChannel({ writableMemberIds: ['u1', 'u2', 'u3', 'u4'] });
  const message = createMessage({ guild, channel });

  const result = await isSafeChannel(message, createConfig({
    autoSafeMaxWritersRatio: 0.3,
    autoSafeMinMembersToCheck: 1,
  }));

  assert.equal(result.safe, false);
  assert.equal(result.reason, 'not_safe');
});

test('not enough members returns safe false with not_enough_members_checked', async () => {
  const guild = createFiveMemberGuild();
  const channel = createChannel({ writableMemberIds: ['u1'] });
  const message = createMessage({ guild, channel });

  const result = await isSafeChannel(message, createConfig({
    autoSafeMinMembersToCheck: 10,
  }));

  assert.equal(result.safe, false);
  assert.equal(result.reason, 'not_enough_members_checked');
});

test('rate-limit or fetch failure returns safe false and does not throw', async () => {
  const guild = createGuild({
    initialMembers: [createMember({ id: 'u1' })],
    fetchedMembers: [
      createMember({ id: 'u1' }),
      createMember({ id: 'u2' }),
      createMember({ id: 'u3' }),
      createMember({ id: 'u4' }),
      createMember({ id: 'u5' }),
    ],
    memberCount: 5,
    fetchError: {
      name: 'GatewayRateLimitError',
      timeout: 1000,
      message: 'Request with opcode 8 was rate limited',
    },
  });
  const channel = createChannel({ writableMemberIds: ['u1'] });
  const message = createMessage({ guild, channel });

  const result = await isSafeChannel(message, createConfig());

  assert.equal(result.safe, false);
  assert.equal(result.reason, 'member_fetch_rate_limited');
});
