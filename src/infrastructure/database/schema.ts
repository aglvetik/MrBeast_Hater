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
    policy: varchar("policy", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.guildId, table.channelId] }),
    guildChannelIndex: index("channel_policies_guild_idx").on(table.guildId)
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
    ruleId: varchar("rule_id", { length: 40 }),
    confidence: varchar("confidence", { length: 20 }).notNull(),
    signals: jsonb("signals").$type<readonly Record<string, string>[]>().notNull(),
    mentionedRoleIds: jsonb("mentioned_role_ids").$type<readonly string[]>().notNull(),
    mediaSummary: jsonb("media_summary").$type<Record<string, unknown>>().notNull(),
    actionRequested: varchar("action_requested", { length: 40 }).notNull(),
    actionResults: jsonb("action_results").$type<Record<string, unknown>>().notNull(),
    dryRun: boolean("dry_run").notNull().default(false),
    falsePositive: boolean("false_positive").notNull().default(false),
    sanctionId: uuid("sanction_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    guildMessageUnique: uniqueIndex("incidents_guild_message_unique").on(
      table.guildId,
      table.messageId
    ),
    guildCreatedIndex: index("incidents_guild_created_idx").on(table.guildId, table.createdAt),
    guildActorCreatedIndex: index("incidents_guild_actor_created_idx").on(
      table.guildId,
      table.actorId,
      table.createdAt
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
  trustedActorsTable: typeof trustedActorsTable;
  sanctionsTable: typeof sanctionsTable;
  incidentsTable: typeof incidentsTable;
  escalationStepsTable: typeof escalationStepsTable;
  configAuditEventsTable: typeof configAuditEventsTable;
};
