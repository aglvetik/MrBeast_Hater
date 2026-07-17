import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const guildSettingsTable = pgTable("guild_settings", {
  guildId: varchar("guild_id", { length: 20 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  locale: varchar("locale", { length: 8 }).notNull(),
  operationMode: varchar("operation_mode", { length: 20 }).notNull(),
  preset: varchar("preset", { length: 20 }).notNull(),
  logChannelId: varchar("log_channel_id", { length: 20 }),
  roleDetectionMode: varchar("role_detection_mode", { length: 20 }).notNull(),
  memberPunishment: varchar("member_punishment", { length: 20 }).notNull(),
  memberTimeoutSeconds: integer("member_timeout_seconds"),
  botPunishment: varchar("bot_punishment", { length: 20 }).notNull(),
  minVisualCount: integer("min_visual_count").notNull(),
  maxInformationChars: integer("max_information_chars").notNull(),
  burstWindowSeconds: integer("burst_window_seconds").notNull(),
  burstMessageCount: integer("burst_message_count").notNull(),
  escalationMode: varchar("escalation_mode", { length: 20 }).notNull(),
  retentionDays: integer("retention_days").notNull(),
  dryRunEnabled: boolean("dry_run_enabled").notNull().default(false),
  linkRuleEnabled: boolean("link_rule_enabled").notNull().default(true),
  sanctionCooldownSeconds: integer("sanction_cooldown_seconds").notNull().default(60),
  firstStrikeBehavior: varchar("first_strike_behavior", { length: 40 })
    .notNull()
    .default("DELETE_ON_FIRST"),
  warmupDays: integer("warmup_days").notNull().default(7),
  guildWarmupStartedAt: timestamp("guild_warmup_started_at", { withTimezone: true }),
  correlationWindowSeconds: integer("correlation_window_seconds").notNull().default(30),
  raidSessionDurationSeconds: integer("raid_session_duration_seconds").notNull().default(300),
  quarantineTimeoutSeconds: integer("quarantine_timeout_seconds").notNull().default(60),
  newAccountMaxAgeHours: integer("new_account_max_age_hours").notNull().default(720),
  newJoinMaxAgeHours: integer("new_join_max_age_hours").notNull().default(168),
  meaningfulTextThreshold: integer("meaningful_text_threshold").notNull().default(80),
  observeThreshold: integer("observe_threshold").notNull().default(35),
  logOnlyThreshold: integer("log_only_threshold").notNull().default(50),
  deleteThreshold: integer("delete_threshold").notNull().default(70),
  quarantineThreshold: integer("quarantine_threshold").notNull().default(90),
  enforceThreshold: integer("enforce_threshold").notNull().default(110),
  deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
  deletionGraceUntil: timestamp("deletion_grace_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const protectedRolesTable = pgTable(
  "protected_roles",
  {
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    roleId: varchar("role_id", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.guildId, table.roleId] }),
    guildRoleIndex: index("protected_roles_guild_idx").on(table.guildId)
  })
);

export const channelPoliciesTable = pgTable(
  "channel_policies",
  {
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    channelId: varchar("channel_id", { length: 20 }).notNull(),
    policy: varchar("policy", { length: 24 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.guildId, table.channelId] }),
    guildChannelIndex: index("channel_policies_guild_idx").on(table.guildId)
  })
);

export const categoryPoliciesTable = pgTable(
  "category_policies",
  {
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    categoryId: varchar("category_id", { length: 20 }).notNull(),
    policy: varchar("policy", { length: 24 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.guildId, table.categoryId] }),
    guildCategoryIndex: index("category_policies_guild_idx").on(table.guildId)
  })
);

export const trustedActorsTable = pgTable(
  "trusted_actors",
  {
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    actorId: varchar("actor_id", { length: 20 }).notNull(),
    actorType: varchar("actor_type", { length: 20 }).notNull(),
    policy: varchar("policy", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.guildId, table.actorId, table.actorType] }),
    guildTrustedIndex: index("trusted_actors_guild_idx").on(table.guildId)
  })
);

export const actorPoliciesTable = pgTable(
  "actor_policies",
  {
    id: uuid("id").primaryKey(),
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    targetId: varchar("target_id", { length: 20 }).notNull(),
    targetType: varchar("target_type", { length: 20 }).notNull(),
    policy: varchar("policy", { length: 24 }).notNull(),
    scopeType: varchar("scope_type", { length: 20 }).notNull(),
    scopeId: varchar("scope_id", { length: 20 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    guildActorPolicyIndex: index("actor_policies_guild_idx").on(table.guildId),
    guildActorScopeUnique: uniqueIndex("actor_policies_scope_unique").on(
      table.guildId,
      table.targetId,
      table.targetType,
      table.scopeType,
      table.scopeId
    )
  })
);

export const roleRiskProfilesTable = pgTable(
  "role_risk_profiles",
  {
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    roleId: varchar("role_id", { length: 20 }).notNull(),
    riskLevel: varchar("risk_level", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.guildId, table.roleId] }),
    guildRoleRiskIndex: index("role_risk_profiles_guild_idx").on(table.guildId)
  })
);

export const sanctionsTable = pgTable(
  "sanctions",
  {
    id: uuid("id").primaryKey(),
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    actorId: varchar("actor_id", { length: 20 }).notNull(),
    actorKind: varchar("actor_kind", { length: 20 }).notNull(),
    punishmentType: varchar("punishment_type", { length: 20 }).notNull(),
    durationSeconds: integer("duration_seconds"),
    applied: boolean("applied").notNull().default(false),
    activeUntil: timestamp("active_until", { withTimezone: true }),
    cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
    sourceIncidentId: uuid("source_incident_id"),
    actionResult: jsonb("action_result").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    guildActorCreatedIndex: index("sanctions_guild_actor_created_idx").on(
      table.guildId,
      table.actorId,
      table.createdAt
    ),
    guildCooldownIndex: index("sanctions_guild_cooldown_idx").on(table.guildId, table.cooldownUntil)
  })
);

export const incidentsTable = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey(),
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    messageId: varchar("message_id", { length: 20 }).notNull(),
    channelId: varchar("channel_id", { length: 20 }).notNull(),
    actorId: varchar("actor_id", { length: 20 }).notNull(),
    actorKind: varchar("actor_kind", { length: 20 }).notNull(),
    eventSource: varchar("event_source", { length: 20 }).notNull().default("CREATE"),
    messageSignatureHash: varchar("message_signature_hash", { length: 64 }),
    ruleId: varchar("rule_id", { length: 40 }),
    confidence: varchar("confidence", { length: 20 }).notNull(),
    signals: jsonb("signals").$type<readonly Record<string, unknown>[]>().notNull(),
    mentionedRoleIds: jsonb("mentioned_role_ids").$type<readonly string[]>().notNull(),
    mediaSummary: jsonb("media_summary").$type<Record<string, unknown>>().notNull(),
    decision: varchar("decision", { length: 20 }).notNull().default("ALLOW"),
    actionRequested: varchar("action_requested", { length: 40 }).notNull(),
    actionResults: jsonb("action_results").$type<Record<string, unknown>>().notNull(),
    explanation: jsonb("explanation").$type<Record<string, unknown>>().notNull().default({}),
    correlationStage: varchar("correlation_stage", { length: 20 }).notNull().default("NONE"),
    exactFingerprint: varchar("exact_fingerprint", { length: 64 }),
    structuralFingerprint: varchar("structural_fingerprint", { length: 64 }),
    protectedMentionClass: varchar("protected_mention_class", { length: 255 }),
    processingState: varchar("processing_state", { length: 20 }).notNull().default("COMPLETED"),
    confirmedStrike: boolean("confirmed_strike").notNull().default(false),
    dryRun: boolean("dry_run").notNull().default(false),
    falsePositive: boolean("false_positive").notNull().default(false),
    sanctionId: uuid("sanction_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    guildMessageUnique: uniqueIndex("incidents_guild_message_signature_unique").on(
      table.guildId,
      table.messageId,
      table.eventSource,
      table.messageSignatureHash
    ),
    guildCreatedIndex: index("incidents_guild_created_idx").on(table.guildId, table.createdAt),
    guildActorCreatedIndex: index("incidents_guild_actor_created_idx").on(
      table.guildId,
      table.actorId,
      table.createdAt
    ),
    guildActorConfirmedIndex: index("incidents_guild_actor_confirmed_idx").on(
      table.guildId,
      table.actorId,
      table.confirmedStrike,
      table.falsePositive,
      table.createdAt
    )
  })
);

export const recentDetectionEventsTable = pgTable(
  "recent_detection_events",
  {
    id: uuid("id").primaryKey(),
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    actorId: varchar("actor_id", { length: 20 }).notNull(),
    channelId: varchar("channel_id", { length: 20 }).notNull(),
    categoryId: varchar("category_id", { length: 20 }),
    categoryPosition: integer("category_position"),
    parentPosition: integer("parent_position"),
    channelPosition: integer("channel_position"),
    exactFingerprint: varchar("exact_fingerprint", { length: 64 }),
    structuralFingerprint: varchar("structural_fingerprint", { length: 64 }),
    protectedMentionClass: varchar("protected_mention_class", { length: 255 }),
    score: integer("score").notNull(),
    decision: varchar("decision", { length: 20 }).notNull(),
    eventSource: varchar("event_source", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
  },
  (table) => ({
    guildRecentDetectionIndex: index("recent_detection_events_guild_idx").on(
      table.guildId,
      table.createdAt
    ),
    guildFingerprintIndex: index("recent_detection_events_fingerprint_idx").on(
      table.guildId,
      table.exactFingerprint,
      table.structuralFingerprint
    ),
    guildExpiresIndex: index("recent_detection_events_expires_idx").on(
      table.guildId,
      table.expiresAt
    )
  })
);

export const raidSessionsTable = pgTable(
  "raid_sessions",
  {
    id: uuid("id").primaryKey(),
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    state: varchar("state", { length: 20 }).notNull(),
    triggeringRule: varchar("triggering_rule", { length: 40 }).notNull(),
    exactFingerprints: jsonb("exact_fingerprints").$type<readonly string[]>().notNull(),
    structuralFingerprints: jsonb("structural_fingerprints").$type<readonly string[]>().notNull(),
    protectedMentionClasses: jsonb("protected_mention_classes")
      .$type<readonly string[]>()
      .notNull(),
    actorIds: jsonb("actor_ids").$type<readonly string[]>().notNull(),
    channelIds: jsonb("channel_ids").$type<readonly string[]>().notNull(),
    overridePayload: jsonb("override_payload").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastMatchedAt: timestamp("last_matched_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    guildRaidStateIndex: index("raid_sessions_guild_state_idx").on(table.guildId, table.state),
    guildRaidExpiryIndex: index("raid_sessions_guild_expiry_idx").on(table.guildId, table.expiresAt)
  })
);

export const actorActivityBucketsTable = pgTable(
  "actor_activity_buckets",
  {
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    actorId: varchar("actor_id", { length: 20 }).notNull(),
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    messageCount: integer("message_count").notNull().default(0),
    protectedVisualCount: integer("protected_visual_count").notNull().default(0),
    legitimatePublisherPosts: integer("legitimate_publisher_posts").notNull().default(0),
    confirmedIncidentCount: integer("confirmed_incident_count").notNull().default(0),
    falsePositiveCorrections: integer("false_positive_corrections").notNull().default(0),
    channelIds: jsonb("channel_ids").$type<readonly string[]>().notNull().default([]),
    lastChannelId: varchar("last_channel_id", { length: 20 }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.guildId, table.actorId, table.bucketStart] }),
    guildActorBucketIndex: index("actor_activity_buckets_guild_idx").on(
      table.guildId,
      table.actorId,
      table.bucketStart
    )
  })
);

export const channelActivityBucketsTable = pgTable(
  "channel_activity_buckets",
  {
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    channelId: varchar("channel_id", { length: 20 }).notNull(),
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    messageCount: integer("message_count").notNull().default(0),
    protectedVisualCount: integer("protected_visual_count").notNull().default(0),
    knownPublisherCount: integer("known_publisher_count").notNull().default(0),
    lastProtectedVisualAt: timestamp("last_protected_visual_at", { withTimezone: true }),
    isRestricted: boolean("is_restricted").notNull().default(false),
    isAnnouncement: boolean("is_announcement").notNull().default(false)
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.guildId, table.channelId, table.bucketStart] }),
    guildChannelBucketIndex: index("channel_activity_buckets_guild_idx").on(
      table.guildId,
      table.channelId,
      table.bucketStart
    )
  })
);

export const escalationStepsTable = pgTable(
  "escalation_steps",
  {
    id: uuid("id").primaryKey(),
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    orderIndex: integer("order_index").notNull(),
    thresholdCount: integer("threshold_count").notNull(),
    windowDays: integer("window_days").notNull(),
    punishmentType: varchar("punishment_type", { length: 20 }).notNull(),
    durationSeconds: integer("duration_seconds"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    guildEscalationIndex: index("escalation_steps_guild_idx").on(table.guildId)
  })
);

export const configAuditEventsTable = pgTable(
  "config_audit_events",
  {
    id: uuid("id").primaryKey(),
    guildId: varchar("guild_id", { length: 20 }).notNull(),
    actorId: varchar("actor_id", { length: 20 }).notNull(),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    guildAuditIndex: index("config_audit_events_guild_idx").on(table.guildId, table.createdAt)
  })
);

export type DatabaseSchema = {
  guildSettingsTable: typeof guildSettingsTable;
  protectedRolesTable: typeof protectedRolesTable;
  channelPoliciesTable: typeof channelPoliciesTable;
  categoryPoliciesTable: typeof categoryPoliciesTable;
  trustedActorsTable: typeof trustedActorsTable;
  actorPoliciesTable: typeof actorPoliciesTable;
  roleRiskProfilesTable: typeof roleRiskProfilesTable;
  sanctionsTable: typeof sanctionsTable;
  incidentsTable: typeof incidentsTable;
  recentDetectionEventsTable: typeof recentDetectionEventsTable;
  raidSessionsTable: typeof raidSessionsTable;
  actorActivityBucketsTable: typeof actorActivityBucketsTable;
  channelActivityBucketsTable: typeof channelActivityBucketsTable;
  escalationStepsTable: typeof escalationStepsTable;
  configAuditEventsTable: typeof configAuditEventsTable;
};
