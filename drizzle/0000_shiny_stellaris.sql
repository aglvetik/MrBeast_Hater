CREATE TABLE "channel_policies" (
	"guild_id" varchar(20) NOT NULL,
	"channel_id" varchar(20) NOT NULL,
	"policy" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_policies_guild_id_channel_id_pk" PRIMARY KEY("guild_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "config_audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"actor_id" varchar(20) NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalation_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"order_index" integer NOT NULL,
	"threshold_count" integer NOT NULL,
	"window_days" integer NOT NULL,
	"punishment_type" varchar(20) NOT NULL,
	"duration_seconds" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_settings" (
	"guild_id" varchar(20) PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"locale" varchar(8) NOT NULL,
	"operation_mode" varchar(20) NOT NULL,
	"preset" varchar(20) NOT NULL,
	"log_channel_id" varchar(20),
	"role_detection_mode" varchar(20) NOT NULL,
	"member_punishment" varchar(20) NOT NULL,
	"member_timeout_seconds" integer,
	"bot_punishment" varchar(20) NOT NULL,
	"min_visual_count" integer NOT NULL,
	"max_information_chars" integer NOT NULL,
	"burst_window_seconds" integer NOT NULL,
	"burst_message_count" integer NOT NULL,
	"escalation_mode" varchar(20) NOT NULL,
	"retention_days" integer NOT NULL,
	"dry_run_enabled" boolean DEFAULT false NOT NULL,
	"link_rule_enabled" boolean DEFAULT true NOT NULL,
	"sanction_cooldown_seconds" integer DEFAULT 60 NOT NULL,
	"deletion_requested_at" timestamp with time zone,
	"deletion_grace_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"message_id" varchar(20) NOT NULL,
	"channel_id" varchar(20) NOT NULL,
	"actor_id" varchar(20) NOT NULL,
	"actor_kind" varchar(20) NOT NULL,
	"rule_id" varchar(40),
	"confidence" varchar(20) NOT NULL,
	"signals" jsonb NOT NULL,
	"mentioned_role_ids" jsonb NOT NULL,
	"media_summary" jsonb NOT NULL,
	"action_requested" varchar(40) NOT NULL,
	"action_results" jsonb NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"false_positive" boolean DEFAULT false NOT NULL,
	"sanction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protected_roles" (
	"guild_id" varchar(20) NOT NULL,
	"role_id" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "protected_roles_guild_id_role_id_pk" PRIMARY KEY("guild_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "sanctions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"actor_id" varchar(20) NOT NULL,
	"actor_kind" varchar(20) NOT NULL,
	"punishment_type" varchar(20) NOT NULL,
	"duration_seconds" integer,
	"applied" boolean DEFAULT false NOT NULL,
	"active_until" timestamp with time zone,
	"cooldown_until" timestamp with time zone,
	"source_incident_id" uuid,
	"action_result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trusted_actors" (
	"guild_id" varchar(20) NOT NULL,
	"actor_id" varchar(20) NOT NULL,
	"actor_type" varchar(20) NOT NULL,
	"policy" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trusted_actors_guild_id_actor_id_actor_type_pk" PRIMARY KEY("guild_id","actor_id","actor_type")
);
--> statement-breakpoint
CREATE INDEX "channel_policies_guild_idx" ON "channel_policies" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "config_audit_events_guild_idx" ON "config_audit_events" USING btree ("guild_id","created_at");--> statement-breakpoint
CREATE INDEX "escalation_steps_guild_idx" ON "escalation_steps" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "incidents_guild_message_unique" ON "incidents" USING btree ("guild_id","message_id");--> statement-breakpoint
CREATE INDEX "incidents_guild_created_idx" ON "incidents" USING btree ("guild_id","created_at");--> statement-breakpoint
CREATE INDEX "incidents_guild_actor_created_idx" ON "incidents" USING btree ("guild_id","actor_id","created_at");--> statement-breakpoint
CREATE INDEX "protected_roles_guild_idx" ON "protected_roles" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "sanctions_guild_actor_created_idx" ON "sanctions" USING btree ("guild_id","actor_id","created_at");--> statement-breakpoint
CREATE INDEX "sanctions_guild_cooldown_idx" ON "sanctions" USING btree ("guild_id","cooldown_until");--> statement-breakpoint
CREATE INDEX "trusted_actors_guild_idx" ON "trusted_actors" USING btree ("guild_id");