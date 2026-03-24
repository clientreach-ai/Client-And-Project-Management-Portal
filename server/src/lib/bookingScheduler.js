import { qstashClient } from './qstash.js';
import { getOwnerEmail } from './email.js';

const toUnixSeconds = (date) => Math.floor(date.getTime() / 1000);

const buildWorkerUrl = () => {
  const baseUrl =
    process.env.BACKEND_BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'http://localhost:4000';
  return `${baseUrl.replace(/\/$/, '')}/api/send-email`;
};

const withRetries = (request, retries = 5) => ({
  ...request,
  retries,
});

const REMINDER_STEPS = [
  {
    key: '1_HOUR',
    minutesBefore: 60,
    label: '1 hour',
    includeLink: false,
  },
  {
    key: '30_MINUTES',
    minutesBefore: 30,
    label: '30 minutes',
    includeLink: false,
  },
  {
    key: '5_MINUTES',
    minutesBefore: 5,
    label: '5 minutes',
    includeLink: true,
  },
];

const formatDateUtc = (scheduledAt) => {
  try {
    return new Date(scheduledAt).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    });
  } catch {
    return new Date(scheduledAt).toISOString();
  }
};

const buildClientReminderPayload = ({
  meetingId,
  attendeeEmail,
  zoomLink,
  label,
  includeLink,
}) => ({
  meetingId,
  emailType: `CLIENT_REMINDER_${label.replace(/\s+/g, '_').toUpperCase()}`,
  idempotencyKey: `${meetingId}:CLIENT_REMINDER:${label}:${attendeeEmail}`,
  to: attendeeEmail,
  subject: `Reminder: your meeting starts in ${label}`,
  text: includeLink
    ? `Your meeting starts in ${label}.\n\nJoin link: ${zoomLink}`
    : `Your meeting starts in ${label}.\n\nWe will send your meeting link in the final reminder 5 minutes before start time.`,
});

const buildOwnerReminderPayload = ({
  meetingId,
  ownerEmail,
  zoomLink,
  label,
  includeLink,
  booking,
}) => {
  const fullName = `${booking.firstName || ''} ${booking.lastName || ''}`.trim();
  const lines = [
    `Upcoming meeting in ${label}`,
    '',
    `Client: ${fullName || 'N/A'}`,
    `Client Email: ${booking.attendeeEmail || 'N/A'}`,
    `Phone: ${booking.phone || 'N/A'}`,
    `Workspace: ${booking.workspaceName || 'N/A'}`,
    `Date/Time (UTC): ${formatDateUtc(booking.scheduledAt)}`,
    `Timezone: ${booking.timezone || 'UTC'}`,
    `Duration: ${booking.durationMinutes || 'N/A'} minutes`,
    `Website: ${booking.websiteUrl || 'N/A'}`,
    `Business Type: ${booking.businessType || 'N/A'}`,
    `Target Audience: ${booking.targetAudience || 'N/A'}`,
    `Monthly Revenue: ${booking.monthlyRevenue || 'N/A'}`,
    `Decision Maker: ${booking.decisionMaker || 'N/A'}`,
  ];

  if (includeLink) {
    lines.push('', `Join link: ${zoomLink}`);
  }

  return {
    meetingId,
    emailType: `OWNER_REMINDER_${label.replace(/\s+/g, '_').toUpperCase()}`,
    idempotencyKey: `${meetingId}:OWNER_REMINDER:${label}:${ownerEmail}`,
    to: ownerEmail,
    subject: `Reminder: ${fullName || 'Client'} meeting starts in ${label}`,
    text: lines.join('\n'),
  };
};

export const scheduleEmails = async ({
  meetingId,
  attendeeEmail,
  zoomLink,
  scheduledAt,
  booking,
}) => {
  const workerUrl = buildWorkerUrl();
  const meetingTimestamp = toUnixSeconds(scheduledAt);
  const nowTimestamp = Math.floor(Date.now() / 1000);
  const ownerEmail = getOwnerEmail();

  const jobs = REMINDER_STEPS.map((step) => {
    const notBefore = meetingTimestamp - step.minutesBefore * 60;
    if (notBefore <= nowTimestamp) {
      return Promise.resolve({ key: step.key, clientMessageId: null, ownerMessageId: null });
    }

    const clientPayload = buildClientReminderPayload({
      meetingId,
      attendeeEmail,
      zoomLink,
      label: step.label,
      includeLink: step.includeLink,
    });

    const ownerPayload = buildOwnerReminderPayload({
      meetingId,
      ownerEmail,
      zoomLink,
      label: step.label,
      includeLink: step.includeLink,
      booking,
    });

    return Promise.all([
      qstashClient.publishJSON(
        withRetries({
          url: workerUrl,
          body: clientPayload,
          notBefore,
        })
      ),
      qstashClient.publishJSON(
        withRetries({
          url: workerUrl,
          body: ownerPayload,
          notBefore,
        })
      ),
    ]).then(([clientJob, ownerJob]) => ({
      key: step.key,
      clientMessageId: clientJob?.messageId || null,
      ownerMessageId: ownerJob?.messageId || null,
    }));
  });

  const results = await Promise.all(jobs);
  const byKey = Object.fromEntries(results.map((result) => [result.key, result]));

  return {
    qstashClientReminder1hMessageId: byKey['1_HOUR']?.clientMessageId || null,
    qstashClientReminder30mMessageId: byKey['30_MINUTES']?.clientMessageId || null,
    qstashClientReminder5mMessageId: byKey['5_MINUTES']?.clientMessageId || null,
    qstashOwnerReminder1hMessageId: byKey['1_HOUR']?.ownerMessageId || null,
    qstashOwnerReminder30mMessageId: byKey['30_MINUTES']?.ownerMessageId || null,
    qstashOwnerReminder5mMessageId: byKey['5_MINUTES']?.ownerMessageId || null,
  };
};

export const cancelScheduledEmails = async (messageIdsInput = []) => {
  const messageIds = messageIdsInput.filter(Boolean);
  if (!messageIds.length) return;

  await Promise.all(
    messageIds.map(async (messageId) => {
      try {
        await qstashClient.messages.cancel(messageId);
      } catch (error) {
        console.error(`Failed to cancel QStash message ${messageId}:`, error);
      }
    })
  );
};
