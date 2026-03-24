import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  image: text('image'),
  password_hash: text('password_hash'),
  role: text('role').default('USER').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  settings: jsonb('settings').default({}),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id),
  image_url: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const workspaceMembers = pgTable('workspace_members', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  role: text('role').notNull(),
  message: text('message'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const clients = pgTable('clients', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  name: text('name').notNull(),
  company: text('company'),
  contactName: text('contact_name'),
  contactRole: text('contact_role'),
  email: text('email'),
  phone: text('phone'),
  website: text('website'),
  industry: text('industry'),
  serviceType: text('service_type'),
  portalWorkspaceId: text('portal_workspace_id').references(
    () => workspaces.id
  ),
  portalProjectId: text('portal_project_id').references(() => projects.id),
  portalUserId: text('portal_user_id').references(() => users.id),
  businessDetails: jsonb('business_details').default({}),
  serviceResponses: jsonb('service_responses').default({}),
  uploadedFiles: jsonb('uploaded_files').default([]),
  calendlyEventId: text('calendly_event_id'),
  status: text('status').default('ACTIVE').notNull(),
  details: jsonb('details').default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const clientIntakes = pgTable('client_intakes', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  clientId: text('client_id').references(() => clients.id),
  token: text('token').notNull(),
  status: text('status').default('OPEN').notNull(),
  serviceType: text('service_type'),
  companyName: text('company_name'),
  contactName: text('contact_name'),
  contactRole: text('contact_role'),
  industry: text('industry'),
  businessDetails: jsonb('business_details').default({}),
  serviceResponses: jsonb('service_responses').default({}),
  uploadedFiles: jsonb('uploaded_files').default([]),
  calendlyEventId: text('calendly_event_id'),
  payload: jsonb('payload').default({}),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const leadIntakes = pgTable('lead_intakes', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  intakeId: text('intake_id')
    .notNull()
    .references(() => clientIntakes.id),
  clientId: text('client_id').references(() => clients.id),
  projectId: text('project_id').references(() => projects.id),
  status: text('status').default('SUBMITTED').notNull(),
  leadStatus: text('lead_status').default('NEW').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  businessModel: text('business_model'),
  sourceKey: text('source_key'),
  biggestBottleneck: text('biggest_bottleneck'),
  payload: jsonb('payload').default({}),
  submittedAt: timestamp('submitted_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const meetingLinks = pgTable('meeting_links', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  token: text('token').notNull().unique(),
  status: text('status').default('OPEN').notNull(),
  title: text('title'),
  durationMinutes: integer('duration_minutes').default(45).notNull(),
  timezone: text('timezone').default('Europe/London').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const meetings = pgTable('meetings', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  meetingLinkId: text('meeting_link_id').references(() => meetingLinks.id),
  status: text('status').default('SCHEDULED').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  websiteUrl: text('website_url'),
  businessType: text('business_type'),
  targetAudience: text('target_audience'),
  monthlyRevenue: text('monthly_revenue'),
  decisionMaker: text('decision_maker'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  scheduledEndAt: timestamp('scheduled_end_at', {
    withTimezone: true,
  }).notNull(),
  timezone: text('timezone').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  zoomMeetingId: text('zoom_meeting_id'),
  zoomJoinUrl: text('zoom_join_url'),
  zoomStartUrl: text('zoom_start_url'),
  qstashClientReminder1hMessageId: text('qstash_client_reminder_1h_message_id'),
  qstashClientReminder30mMessageId: text(
    'qstash_client_reminder_30m_message_id'
  ),
  qstashClientReminder5mMessageId: text('qstash_client_reminder_5m_message_id'),
  qstashOwnerReminder1hMessageId: text('qstash_owner_reminder_1h_message_id'),
  qstashOwnerReminder30mMessageId: text('qstash_owner_reminder_30m_message_id'),
  qstashOwnerReminder5mMessageId: text('qstash_owner_reminder_5m_message_id'),
  qstashReminderMessageId: text('qstash_reminder_message_id'),
  qstashJoinMessageId: text('qstash_join_message_id'),
  payload: jsonb('payload').default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const emailDispatches = pgTable(
  'email_dispatches',
  {
    id: text('id').primaryKey(),
    idempotencyKey: text('idempotency_key').notNull(),
    meetingId: text('meeting_id').references(() => meetings.id, {
      onDelete: 'cascade',
    }),
    emailType: text('email_type'),
    recipient: text('recipient').notNull(),
    providerMessageId: text('provider_message_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    idempotencyKeyUniqueIdx: uniqueIndex(
      'email_dispatches_idempotency_key_uidx'
    ).on(table.idempotencyKey),
  })
);

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  clientId: text('client_id').references(() => clients.id),
  sourceProjectId: text('source_project_id').references(() => projects.id),
  name: text('name').notNull(),
  description: text('description'),
  priority: text('priority').notNull(),
  status: text('status').notNull(),
  start_date: timestamp('start_date', { withTimezone: true }),
  end_date: timestamp('end_date', { withTimezone: true }),
  team_lead: text('team_lead').references(() => users.id),
  progress: integer('progress').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const projectMembers = pgTable('project_members', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  sourceTaskId: text('source_task_id').references(() => tasks.id),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  type: text('type').notNull(),
  priority: text('priority').notNull(),
  assigneeId: text('assignee_id').references(() => users.id),
  due_date: timestamp('due_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const comments = pgTable('comments', {
  id: text('id').primaryKey(),
  taskId: text('task_id')
    .notNull()
    .references(() => tasks.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  senderId: text('sender_id')
    .notNull()
    .references(() => users.id),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const invitations = pgTable('invitations', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  token: text('token').notNull(),
  role: text('role').notNull(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  projectId: text('project_id').references(() => projects.id),
  invitedBy: text('invited_by').references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const sharedFiles = pgTable('shared_files', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  clientId: text('client_id').references(() => clients.id),
  projectId: text('project_id').references(() => projects.id),
  name: text('name').notNull(),
  type: text('type').notNull(),
  url: text('url').notNull(),
  size: integer('size'),
  mimeType: text('mime_type'),
  cloudinaryPublicId: text('cloudinary_public_id'),
  uploadedBy: text('uploaded_by').references(() => users.id),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  clientId: text('client_id')
    .notNull()
    .references(() => clients.id),
  createdBy: text('created_by').references(() => users.id),
  invoiceNumber: text('invoice_number').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  currency: text('currency').default('USD').notNull(),
  amountCents: integer('amount_cents').notNull(),
  amountPaidCents: integer('amount_paid_cents').default(0).notNull(),
  status: text('status').default('DRAFT').notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  stripeCheckoutSessionId: text('stripe_checkout_session_id'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
