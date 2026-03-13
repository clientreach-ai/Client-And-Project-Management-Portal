import { generateId } from './ids.js';
import {
  getEmailFromAddress,
  getOwnerEmail,
  isEmailConfigured,
  sendEmail,
} from './email.js';

export const MEETING_REMINDER_SCHEDULES = [
  {
    key: 'REMINDER_2_HOURS',
    minutesBefore: 120,
    label: '2 hours',
  },
  {
    key: 'REMINDER_1_HOUR',
    minutesBefore: 60,
    label: '1 hour',
  },
  {
    key: 'REMINDER_30_MINUTES',
    minutesBefore: 30,
    label: '30 minutes',
  },
  {
    key: 'REMINDER_5_MINUTES',
    minutesBefore: 5,
    label: '5 minutes',
  },
];

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildBrandedEmailShell = ({ greeting, intro, content, ctaLabel }) => `
<html><body style="margin:0;padding:0;background:#f0f8ff;font-family:Arial,sans-serif;"><table width="100%" style="background:#f0f8ff;padding:40px 20px;"><tr><td align="center"><table width="600" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(20,163,246,0.08);"><tr><td style="background:#ffffff;padding:32px 40px;text-align:center;border-bottom:3px solid #14A3F6;"><table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="font-size:26px;font-weight:800;color:#0a2540;font-family:Arial,sans-serif;">Client<span style="color:#14A3F6;">Reach</span>.ai</td></tr></table></td></tr><tr><td style="padding:36px 40px;"><p style="color:#0a2540;font-size:18px;font-weight:600;margin:0 0 18px;">${greeting}</p><p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 24px;">${intro}</p>${content}<p style="color:#4a5568;font-size:14px;line-height:1.6;margin:24px 0 0;">${ctaLabel || 'If you need anything before the call, just reply to this email.'}</p><p style="color:#0a2540;font-size:14px;margin:22px 0 0;">Talk soon,<br><strong>The ClientReach.ai Team</strong></p></td></tr><tr><td style="background:#f8fbff;padding:18px 40px;text-align:center;border-top:1px solid #e8f0fe;"><p style="color:#94a3b8;font-size:11px;margin:0;">&copy; 2026 ClientReach.ai &mdash; Scale Your Business, Not Your Headcount.</p></td></tr></table></td></tr></table></body></html>
`;

const buildClientBookingSummaryCard = ({
  formattedDate,
  timezone,
  durationMinutes,
  extraNote,
}) => `
  <div style="background:#f8fbff;border:1px solid #e8f0fe;border-radius:14px;padding:22px 24px;margin:0 0 24px;">
    <p style="margin:0 0 10px;color:#0a2540;font-size:14px;font-weight:700;letter-spacing:0.2px;">Your call details</p>
    <p style="margin:0 0 8px;color:#4a5568;font-size:14px;line-height:1.6;"><strong style="color:#0a2540;">Date &amp; time:</strong> ${escapeHtml(formattedDate)}</p>
    <p style="margin:0 0 8px;color:#4a5568;font-size:14px;line-height:1.6;"><strong style="color:#0a2540;">Time zone:</strong> ${escapeHtml(timezone || 'N/A')}</p>
    <p style="margin:0;color:#4a5568;font-size:14px;line-height:1.6;"><strong style="color:#0a2540;">Duration:</strong> ${escapeHtml(String(durationMinutes || 'N/A'))} minutes</p>
  </div>
  ${extraNote ? `<p style="color:#4a5568;font-size:14px;line-height:1.7;margin:0;">${extraNote}</p>` : ''}
`;

const buildTechnicalBookingEmailHtml = ({
  heading,
  fullName,
  email,
  phone,
  websiteUrl,
  businessType,
  targetAudience,
  monthlyRevenue,
  decisionMaker,
  workspaceName,
  formattedDate,
  timezone,
  durationMinutes,
}) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
    <h2 style="margin: 0 0 12px;">${heading}</h2>
    <p style="margin: 0 0 4px;"><strong>Name:</strong> ${escapeHtml(fullName || 'N/A')}</p>
    <p style="margin: 0 0 4px;"><strong>Email:</strong> ${escapeHtml(email || 'N/A')}</p>
    <p style="margin: 0 0 4px;"><strong>Phone:</strong> ${escapeHtml(phone || 'N/A')}</p>
    <p style="margin: 0 0 4px;"><strong>Website:</strong> ${escapeHtml(websiteUrl || 'N/A')}</p>
    <p style="margin: 0 0 4px;"><strong>Business Type:</strong> ${escapeHtml(businessType || 'N/A')}</p>
    <p style="margin: 0 0 4px;"><strong>Target Audience:</strong> ${escapeHtml(targetAudience || 'N/A')}</p>
    <p style="margin: 0 0 4px;"><strong>Monthly Revenue:</strong> ${escapeHtml(monthlyRevenue || 'N/A')}</p>
    <p style="margin: 0 0 4px;"><strong>Decision Maker:</strong> ${escapeHtml(decisionMaker || 'N/A')}</p>
    <p style="margin: 0 0 4px;"><strong>Workspace:</strong> ${escapeHtml(workspaceName || 'N/A')}</p>
    <p style="margin: 0 0 4px;"><strong>Date &amp; Time:</strong> ${escapeHtml(formattedDate)}</p>
    <p style="margin: 0 0 4px;"><strong>Timezone:</strong> ${escapeHtml(timezone || 'N/A')}</p>
    <p style="margin: 0;"><strong>Duration:</strong> ${escapeHtml(String(durationMinutes || 'N/A'))} minutes</p>
  </div>
`;

export const formatBookingDate = (scheduledAt, timezone) => {
  if (!scheduledAt) return 'N/A';

  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return 'N/A';

  try {
    return date.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone || undefined,
    });
  } catch {
    return date.toLocaleString();
  }
};

const getReminderLabel = (minutesBefore) => {
  const config = MEETING_REMINDER_SCHEDULES.find(
    (entry) => entry.minutesBefore === minutesBefore
  );

  if (config) return config.label;
  if (minutesBefore % 60 === 0) {
    const hours = minutesBefore / 60;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  return `${minutesBefore} minutes`;
};

export const buildMeetingReminderValues = ({
  meetingId,
  scheduledAt,
  now = new Date(),
}) => {
  const scheduledDate = new Date(scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) return [];

  return MEETING_REMINDER_SCHEDULES.map(({ key, minutesBefore }) => {
    const scheduledFor = new Date(
      scheduledDate.getTime() - minutesBefore * 60 * 1000
    );

    return {
      id: generateId('meeting_reminder'),
      meetingId,
      reminderType: key,
      minutesBefore,
      scheduledFor,
      status: 'PENDING',
      updatedAt: now,
    };
  }).filter((reminder) => reminder.scheduledFor > now);
};

export const sendMeetingBookingEmails = async ({
  workspaceName,
  firstName,
  lastName,
  phone,
  email,
  websiteUrl,
  businessType,
  targetAudience,
  monthlyRevenue,
  decisionMaker,
  timezone,
  durationMinutes,
  scheduledAt,
}) => {
  if (!isEmailConfigured()) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const fromAddress = getEmailFromAddress();
  const ownerEmail = getOwnerEmail();
  const fullName = `${firstName} ${lastName}`.trim();
  const formattedDate = formatBookingDate(scheduledAt, timezone);
  const customerHtml = buildBrandedEmailShell({
    greeting: `Hey ${escapeHtml(firstName || 'there')},`,
    intro:
      'Your booking is confirmed. We are looking forward to speaking with you and helping you make the most of the session.',
    content: buildClientBookingSummaryCard({
      formattedDate,
      timezone,
      durationMinutes,
      extraNote:
        'You do not need to bring anything special. Just be ready a few minutes early and keep an eye on your inbox for reminders before the call.',
    }),
  });

  const ownerHtml = buildTechnicalBookingEmailHtml({
    heading: 'New Booking Received 📅',
    fullName,
    email,
    phone,
    websiteUrl,
    businessType,
    targetAudience,
    monthlyRevenue,
    decisionMaker,
    workspaceName,
    formattedDate,
    timezone,
    durationMinutes,
  });

  await Promise.all([
    sendEmail({ from: fromAddress, to: email, subject: 'Your booking is confirmed', html: customerHtml }),
    sendEmail({ from: fromAddress, to: ownerEmail, subject: `New booking: ${fullName || 'Unknown contact'}`, html: ownerHtml }),
  ]);
};

export const sendMeetingReminderEmails = async ({
  workspaceName,
  firstName,
  lastName,
  email,
  phone,
  timezone,
  durationMinutes,
  scheduledAt,
  minutesBefore,
}) => {
  if (!isEmailConfigured()) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const fromAddress = getEmailFromAddress();
  const ownerEmail = getOwnerEmail();
  const fullName = `${firstName} ${lastName}`.trim();
  const reminderLabel = getReminderLabel(minutesBefore);
  const formattedDate = formatBookingDate(scheduledAt, timezone);
  const customerHtml = buildBrandedEmailShell({
    greeting: `Hey ${escapeHtml(firstName || 'there')},`,
    intro: `Just a quick reminder that your call starts in ${escapeHtml(reminderLabel)}.`,
    content: buildClientBookingSummaryCard({
      formattedDate,
      timezone,
      durationMinutes,
      extraNote:
        'Please join on time and make sure you are in a quiet place with a stable connection so we can make the session as useful as possible.',
    }),
    ctaLabel:
      'Need to share an update before the call? Reply to this email and our team will see it.',
  });

  const ownerHtml = buildTechnicalBookingEmailHtml({
    heading: `Upcoming booking in ${escapeHtml(reminderLabel)} 📅`,
    fullName,
    email,
    phone,
    websiteUrl: null,
    businessType: null,
    targetAudience: null,
    monthlyRevenue: null,
    decisionMaker: null,
    workspaceName,
    formattedDate,
    timezone,
    durationMinutes,
  });

  await Promise.all([
    sendEmail({ from: fromAddress, to: email, subject: `Reminder: your call starts in ${reminderLabel}`, html: customerHtml }),
    sendEmail({ from: fromAddress, to: ownerEmail, subject: `Upcoming booking in ${reminderLabel}: ${fullName || 'Unknown contact'}`, html: ownerHtml }),
  ]);
};
