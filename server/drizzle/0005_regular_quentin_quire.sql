CREATE TABLE "email_dispatches" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"meeting_id" text,
	"email_type" text,
	"recipient" text NOT NULL,
	"provider_message_id" text,
	"sent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "zoom_meeting_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "zoom_join_url" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "zoom_start_url" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "qstash_reminder_message_id" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "qstash_join_message_id" text;--> statement-breakpoint
ALTER TABLE "email_dispatches" ADD CONSTRAINT "email_dispatches_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_dispatches_idempotency_key_uidx" ON "email_dispatches" USING btree ("idempotency_key");
