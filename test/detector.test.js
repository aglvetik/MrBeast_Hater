const test = require('node:test');
const assert = require('node:assert/strict');

const { detectSpam } = require('../src/detector');
const {
  createChannel,
  createGuild,
  createMember,
  createMessage,
  createRole,
} = require('./helpers/mockDiscord');

function createConfig(overrides = {}) {
  return {
    massRoleThreshold: 0.3,
    maxCleanTextLength: 20,
    forcedMassRoleIds: new Set(),
    bypassRoleIds: new Set(),
    ignoredChannelIds: new Set(),
    debugRoleCoverage: false,
    memberFetchTtlSeconds: 300,
    memberFetchCacheFullRatio: 0.9,
    ...overrides,
  };
}

function createGuildWithMembers(roleAssignments = {}, options = {}) {
  const members = [
    createMember({ id: 'u1', roleIds: roleAssignments.u1 || [] }),
    createMember({ id: 'u2', roleIds: roleAssignments.u2 || [] }),
    createMember({ id: 'u3', roleIds: roleAssignments.u3 || [] }),
    createMember({ id: 'u4', roleIds: roleAssignments.u4 || [] }),
    createMember({ id: 'u5', roleIds: roleAssignments.u5 || [] }),
  ];

  return createGuild({
    initialMembers: options.initialMembers || members,
    fetchedMembers: members,
    memberCount: 5,
    ...options,
  });
}

test('@everyone + image + empty text is detected', async () => {
  const guild = createGuildWithMembers();
  const message = createMessage({
    guild,
    channel: createChannel({ writableMemberIds: ['u1', 'u2', 'u3', 'u4', 'u5'] }),
    content: '@everyone',
    mentionEveryone: true,
  });

  const result = await detectSpam(message, createConfig());
  assert.equal(result.detected, true);
});

test('@here + image + empty text is detected', async () => {
  const guild = createGuildWithMembers();
  const message = createMessage({
    guild,
    channel: createChannel({ writableMemberIds: ['u1', 'u2', 'u3', 'u4', 'u5'] }),
    content: '@here',
    mentionEveryone: true,
  });

  const result = await detectSpam(message, createConfig());
  assert.equal(result.detected, true);
});

test('forced mass role + image + empty text is detected without member fetch', async () => {
  const guild = createGuild({
    initialMembers: [createMember({ id: 'u1' })],
    fetchedMembers: [
      createMember({ id: 'u1', roleIds: ['forced-role'] }),
      createMember({ id: 'u2' }),
      createMember({ id: 'u3' }),
      createMember({ id: 'u4' }),
      createMember({ id: 'u5' }),
    ],
    memberCount: 5,
  });
  const role = createRole({ id: 'forced-role', name: 'ForcedRole', cacheCount: 1 });
  const message = createMessage({
    guild,
    channel: createChannel({ writableMemberIds: ['u1', 'u2', 'u3', 'u4', 'u5'] }),
    content: '<@&forced-role>',
    mentionedRoles: [role],
  });

  const result = await detectSpam(message, createConfig({
    forcedMassRoleIds: new Set(['forced-role']),
  }));

  assert.equal(result.detected, true);
  assert.equal(guild.getFetchCalls(), 0);
});

test('normal user mention + image + empty text is not detected', async () => {
  const guild = createGuildWithMembers();
  const message = createMessage({
    guild,
    channel: createChannel({ writableMemberIds: ['u1', 'u2', 'u3', 'u4', 'u5'] }),
    content: '<@12345>',
    mentionEveryone: false,
    mentionedRoles: [],
  });

  const result = await detectSpam(message, createConfig());
  assert.equal(result.detected, false);
});

test('mass role + no image is not detected', async () => {
  const guild = createGuildWithMembers({
    u1: ['mass-role'],
    u2: ['mass-role'],
    u3: ['mass-role'],
  });
  const role = createRole({ id: 'mass-role', name: 'MassRole', cacheCount: 1 });
  const message = createMessage({
    guild,
    channel: createChannel({ writableMemberIds: ['u1', 'u2', 'u3', 'u4', 'u5'] }),
    content: '<@&mass-role>',
    mentionedRoles: [role],
    attachments: [],
  });

  const result = await detectSpam(message, createConfig());
  assert.equal(result.detected, false);
});

test('image + no mass ping is not detected', async () => {
  const guild = createGuildWithMembers();
  const message = createMessage({
    guild,
    channel: createChannel({ writableMemberIds: ['u1', 'u2', 'u3', 'u4', 'u5'] }),
    content: '',
    mentionEveryone: false,
    mentionedRoles: [],
  });

  const result = await detectSpam(message, createConfig());
  assert.equal(result.detected, false);
});

test('mass role + image + real text is not detected', async () => {
  const guild = createGuildWithMembers({
    u1: ['mass-role'],
    u2: ['mass-role'],
    u3: ['mass-role'],
  });
  const role = createRole({ id: 'mass-role', name: 'MassRole', cacheCount: 1 });
  const message = createMessage({
    guild,
    channel: createChannel({ writableMemberIds: ['u1', 'u2', 'u3', 'u4', 'u5'] }),
    content: '<@&mass-role> this is definitely real text for the detector',
    mentionedRoles: [role],
  });

  const result = await detectSpam(message, createConfig());
  assert.equal(result.detected, false);
});

test('non-forced role coverage 3 of 5 members is detected as mass', async () => {
  const guild = createGuild({
    initialMembers: [createMember({ id: 'seed' })],
    fetchedMembers: [
      createMember({ id: 'u1', roleIds: ['mass-role'] }),
      createMember({ id: 'u2', roleIds: ['mass-role'] }),
      createMember({ id: 'u3', roleIds: ['mass-role'] }),
      createMember({ id: 'u4' }),
      createMember({ id: 'u5' }),
    ],
    memberCount: 5,
  });
  const role = createRole({ id: 'mass-role', name: 'MassRole', cacheCount: 1 });
  const message = createMessage({
    guild,
    channel: createChannel({ writableMemberIds: ['u1', 'u2', 'u3', 'u4', 'u5'] }),
    content: '<@&mass-role>',
    mentionedRoles: [role],
  });

  const result = await detectSpam(message, createConfig({
    massRoleThreshold: 0.3,
  }));

  assert.equal(result.detected, true);
  assert.equal(result.roleCoverage[0].memberCount, 3);
});

test('non-forced role coverage 1 of 5 members is not detected as mass', async () => {
  const guild = createGuild({
    initialMembers: [createMember({ id: 'seed' })],
    fetchedMembers: [
      createMember({ id: 'u1', roleIds: ['small-role'] }),
      createMember({ id: 'u2' }),
      createMember({ id: 'u3' }),
      createMember({ id: 'u4' }),
      createMember({ id: 'u5' }),
    ],
    memberCount: 5,
  });
  const role = createRole({ id: 'small-role', name: 'SmallRole', cacheCount: 1 });
  const message = createMessage({
    guild,
    channel: createChannel({ writableMemberIds: ['u1', 'u2', 'u3', 'u4', 'u5'] }),
    content: '<@&small-role>',
    mentionedRoles: [role],
  });

  const result = await detectSpam(message, createConfig({
    massRoleThreshold: 0.3,
  }));

  assert.equal(result.detected, false);
});
