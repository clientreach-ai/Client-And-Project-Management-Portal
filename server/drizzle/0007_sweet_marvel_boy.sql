ALTER TABLE "meetings" ADD COLUMN "qstash_client_reminder_1h_message_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "qstash_client_reminder_30m_message_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "qstash_client_reminder_5m_message_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "qstash_owner_reminder_1h_message_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "qstash_owner_reminder_30m_message_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "qstash_owner_reminder_5m_message_id" text;