let nextId = 1;

function uniqueId(prefix) {
  const id = `${prefix}-${nextId}`;
  nextId += 1;
  return id;
}

function createRoleCache(roleIds = []) {
  const ids = new Set(roleIds);

  return {
    has(roleId) {
      return ids.has(roleId);
    },
    some(fn) {
      return [...ids].some((roleId) => fn({ id: roleId }));
    },
  };
}

function createMember(options = {}) {
  const {
    id = uniqueId('member'),
    roleIds = [],
    bot = false,
    username = id,
    displayName = username,
  } = options;

  return {
    id,
    user: {
      bot,
      username,
      tag: `${username}#0001`,
    },
    displayName,
    roles: {
      cache: createRoleCache(roleIds),
    },
  };
}

function createMembersMap(members) {
  return new Map(members.map((member) => [member.id, member]));
}

function createGuild(options = {}) {
  const {
    id = uniqueId('guild'),
    ownerId = 'owner',
    initialMembers = [],
    fetchedMembers = initialMembers,
    memberCount = fetchedMembers.length,
    fetchError = null,
    fetchDelayMs = 0,
  } = options;

  let cache = createMembersMap(initialMembers);
  let fetchCalls = 0;
  let currentFetchedMembers = fetchedMembers;
  let currentFetchError = fetchError;

  return {
    id,
    ownerId,
    memberCount,
    members: {
      get cache() {
        return cache;
      },
      set cache(value) {
        cache = value;
      },
      async fetch() {
        fetchCalls += 1;

        if (fetchDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, fetchDelayMs));
        }

        if (currentFetchError) {
          throw currentFetchError;
        }

        cache = createMembersMap(currentFetchedMembers);
        return cache;
      },
    },
    getFetchCalls() {
      return fetchCalls;
    },
    setFetchedMembers(members) {
      currentFetchedMembers = members;
    },
    setFetchError(error) {
      currentFetchError = error;
    },
  };
}

function createChannel(options = {}) {
  const {
    id = uniqueId('channel'),
    writableMemberIds = [],
    textBased = true,
    permissionsError = null,
  } = options;

  const writableIds = new Set(writableMemberIds);

  return {
    id,
    isTextBased() {
      return textBased;
    },
    permissionsFor(member) {
      if (permissionsError) {
        throw permissionsError;
      }

      return {
        has() {
          return writableIds.has(member.id);
        },
      };
    },
  };
}

function createRole(options = {}) {
  const {
    id = uniqueId('role'),
    name = id,
    cacheCount = 0,
  } = options;

  return {
    id,
    name,
    members: {
      size: cacheCount,
    },
  };
}

function createAttachment(options = {}) {
  const {
    name = 'image.jpg',
    contentType = 'image/jpeg',
  } = options;

  return {
    name,
    contentType,
  };
}

function createMessage(options = {}) {
  const {
    id = uniqueId('message'),
    guild = null,
    channel = createChannel(),
    content = '',
    authorId = uniqueId('author'),
    authorBot = false,
    username = authorId,
    displayName = username,
    mentionEveryone = false,
    mentionedRoles = [],
    attachments = [createAttachment()],
    memberRoleIds = [],
  } = options;

  return {
    id,
    content,
    guild,
    channel,
    channelId: channel.id,
    author: {
      id: authorId,
      bot: authorBot,
      username,
      tag: `${username}#0001`,
    },
    member: guild ? {
      displayName,
      roles: {
        cache: createRoleCache(memberRoleIds),
      },
      async timeout() {},
    } : null,
    mentions: {
      everyone: mentionEveryone,
      roles: new Map(mentionedRoles.map((role) => [role.id, role])),
    },
    roleMentions: new Map(mentionedRoles.map((role) => [role.id, role])),
    attachments: new Map(attachments.map((attachment, index) => [String(index), attachment])),
  };
}

module.exports = {
  createAttachment,
  createChannel,
  createGuild,
  createMember,
  createMessage,
  createRole,
};
