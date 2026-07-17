CREATE TABLE "actor_activity_buckets" (
	"guild_id" varchar(20) NOT NULL,
	"actor_id" varchar(20) NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"protected_visual_count" integer DEFAULT 0 NOT NULL,
	"legitimate_publisher_posts" integer DEFAULT 0 NOT NULL,
	"confirmed_incident_count" integer DEFAULT 0 NOT NULL,
	"false_positive_corrections" integer DEFAULT 0 NOT NULL,
	"channel_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_channel_id" varchar(20),
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actor_activity_buckets_guild_id_actor_id_bucket_start_pk" PRIMARY KEY("guild_id","actor_id","bucket_start")
);
--> statement-breakpoint
CREATE TABLE "actor_policies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"target_id" varchar(20) NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"policy" varchar(24) NOT NULL,
	"scope_type" varchar(20) NOT NULL,
	"scope_id" varchar(20),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_policies" (
	"guild_id" varchar(20) NOT NULL,
	"category_id" varchar(20) NOT NULL,
	"policy" varchar(24) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_policies_guild_id_category_id_pk" PRIMARY KEY("guild_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "channel_activity_buckets" (
	"guild_id" varchar(20) NOT NULL,
	"channel_id" varchar(20) NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"protected_visual_count" integer DEFAULT 0 NOT NULL,
	"known_publisher_count" integer DEFAULT 0 NOT NULL,
	"last_protected_visual_at" timestamp with time zone,
	"is_restricted" boolean DEFAULT false NOT NULL,
	"is_announcement" boolean DEFAULT false NOT NULL,
	CONSTRAINT "channel_activity_buckets_guild_id_channel_id_bucket_start_pk" PRIMARY KEY("guild_id","channel_id","bucket_start")
);
--> statement-breakpoint
CREATE TABLE "raid_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"state" varchar(20) NOT NULL,
	"triggering_rule" varchar(40) NOT NULL,
	"exact_fingerprints" jsonb NOT NULL,
	"structural_fingerprints" jsonb NOT NULL,
	"protected_mention_classes" jsonb NOT NULL,
	"actor_ids" jsonb NOT NULL,
	"channel_ids" jsonb NOT NULL,
	"override_payload" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_matched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recent_detection_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"guild_id" varchar(20) NOT NULL,
	"actor_id" varchar(20) NOT NULL,
	"channel_id" varchar(20) NOT NULL,
	"category_id" varchar(20),
	"category_position" integer,
	"parent_position" integer,
	"channel_position" integer,
	"exact_fingerprint" varchar(64),
	"structural_fingerprint" varchar(64),
	"protected_mention_class" varchar(255),
	"score" integer NOT NULL,
	"decision" varchar(20) NOT NULL,
	"event_source" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_risk_profiles" (
	"guild_id" varchar(20) NOT NULL,
	"role_id" varchar(20) NOT NULL,
	"risk_level" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_risk_profiles_guild_id_role_id_pk" PRIMARY KEY("guild_id","role_id")
);
--> statement-breakpoint
DROP INDEX "incidents_guild_message_unique";--> statement-breakpoint
ALTER TABLE "channel_policies" ALTER COLUMN "policy" SET DATA TYPE varchar(24);--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "first_strike_behavior" varchar(40) DEFAULT 'DELETE_ON_FIRST' NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "warmup_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "guild_warmup_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "correlation_window_seconds" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "raid_session_duration_seconds" integer DEFAULT 300 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "quarantine_timeout_seconds" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "new_account_max_age_hours" integer DEFAULT 720 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "new_join_max_age_hours" integer DEFAULT 168 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "meaningful_text_threshold" integer DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "observe_threshold" integer DEFAULT 35 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "log_only_threshold" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "delete_threshold" integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "quarantine_threshold" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_settings" ADD COLUMN "enforce_threshold" integer DEFAULT 110 NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "event_source" varchar(20) DEFAULT 'CREATE' NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "message_signature_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "decision" varchar(20) DEFAULT 'ALLOW' NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "explanation" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "correlation_stage" varchar(20) DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "exact_fingerprint" varchar(64);--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "structural_fingerprint" varchar(64);--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "protected_mention_class" varchar(255);--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "processing_state" varchar(20) DEFAULT 'COMPLETED' NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "confirmed_strike" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "actor_activity_buckets_guild_idx" ON "actor_activity_buckets" USING btree ("guild_id","actor_id","bucket_start");--> statement-breakpoint
CREATE INDEX "actor_policies_guild_idx" ON "actor_policies" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "actor_policies_scope_unique" ON "actor_policies" USING btree ("guild_id","target_id","target_type","scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "category_policies_guild_idx" ON "category_policies" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "channel_activity_buckets_guild_idx" ON "channel_activity_buckets" USING btree ("guild_id","channel_id","bucket_start");--> statement-breakpoint
CREATE INDEX "raid_sessions_guild_state_idx" ON "raid_sessions" USING btree ("guild_id","state");--> statement-breakpoint
CREATE INDEX "raid_sessions_guild_expiry_idx" ON "raid_sessions" USING btree ("guild_id","expires_at");--> statement-breakpoint
CREATE INDEX "recent_detection_events_guild_idx" ON "recent_detection_events" USING btree ("guild_id","created_at");--> statement-breakpoint
CREATE INDEX "recent_detection_events_fingerprint_idx" ON "recent_detection_events" USING btree ("guild_id","exact_fingerprint","structural_fingerprint");--> statement-breakpoint
CREATE INDEX "recent_detection_events_expires_idx" ON "recent_detection_events" USING btree ("guild_id","expires_at");--> statement-breakpoint
CREATE INDEX "role_risk_profiles_guild_idx" ON "role_risk_profiles" USING btree ("guild_id");--> statement-breakpoint
CREATE UNIQUE INDEX "incidents_guild_message_signature_unique" ON "incidents" USING btree ("guild_id","message_id","event_source","message_signature_hash");--> statement-breakpoint
CREATE INDEX "incidents_guild_actor_confirmed_idx" ON "incidents" USING btree ("guild_id","actor_id","confirmed_strike","false_positive","created_at");