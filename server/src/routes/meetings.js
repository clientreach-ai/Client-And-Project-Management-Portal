import { Router } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { meetingLinks, meetings, workspaces } from '../db/schema.js';
import { generateId } from '../lib/ids.js';
import { requireAuth } from '../middleware/auth.js';
import { isWorkspaceAdmin } from '../lib/permissions.js';

const router = Router();

const toSafeString = (value) => (typeof value === 'string' ? value.trim() : '');

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const formatBookingDate = (scheduledAt, timezone) => {
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

const sendMeetingBookingEmails = async ({
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
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER or EMAIL_PASS is not configured');
  }

  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const ownerEmail = process.env.EMAIL_USER;
  const fullName = `${firstName} ${lastName}`.trim();
  const formattedDate = formatBookingDate(scheduledAt, timezone);
  const safeWorkspaceName = workspaceName || 'your workspace';

  const customerHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin: 0 0 12px;">Booking Confirmed ✅</h2>
      <p style="margin: 0 0 12px;">Hi ${escapeHtml(firstName)}, your booking has been received.</p>
      <p style="margin: 0 0 4px;"><strong>Workspace:</strong> ${escapeHtml(safeWorkspaceName)}</p>
      <p style="margin: 0 0 4px;"><strong>Date & Time:</strong> ${escapeHtml(formattedDate)}</p>
      <p style="margin: 0 0 4px;"><strong>Timezone:</strong> ${escapeHtml(timezone || 'N/A')}</p>
      <p style="margin: 0 0 12px;"><strong>Duration:</strong> ${escapeHtml(String(durationMinutes || 'N/A'))} minutes</p>
      <p style="margin: 0; color: #4b5563;">Thanks for booking with us.</p>
    </div>
  `;

  const ownerHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin: 0 0 12px;">New Booking Received 📅</h2>
      <p style="margin: 0 0 4px;"><strong>Name:</strong> ${escapeHtml(fullName || 'N/A')}</p>
      <p style="margin: 0 0 4px;"><strong>Email:</strong> ${escapeHtml(email || 'N/A')}</p>
      <p style="margin: 0 0 4px;"><strong>Phone:</strong> ${escapeHtml(phone || 'N/A')}</p>
      <p style="margin: 0 0 4px;"><strong>Website:</strong> ${escapeHtml(websiteUrl || 'N/A')}</p>
      <p style="margin: 0 0 4px;"><strong>Business Type:</strong> ${escapeHtml(businessType || 'N/A')}</p>
      <p style="margin: 0 0 4px;"><strong>Target Audience:</strong> ${escapeHtml(targetAudience || 'N/A')}</p>
      <p style="margin: 0 0 4px;"><strong>Monthly Revenue:</strong> ${escapeHtml(monthlyRevenue || 'N/A')}</p>
      <p style="margin: 0 0 4px;"><strong>Decision Maker:</strong> ${escapeHtml(decisionMaker || 'N/A')}</p>
      <p style="margin: 0 0 4px;"><strong>Workspace:</strong> ${escapeHtml(safeWorkspaceName)}</p>
      <p style="margin: 0 0 4px;"><strong>Date & Time:</strong> ${escapeHtml(formattedDate)}</p>
      <p style="margin: 0 0 4px;"><strong>Timezone:</strong> ${escapeHtml(timezone || 'N/A')}</p>
      <p style="margin: 0;"><strong>Duration:</strong> ${escapeHtml(String(durationMinutes || 'N/A'))} minutes</p>
    </div>
  `;

  const mailJobs = [
    transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: 'Your booking is confirmed',
      html: customerHtml,
    }),
    transporter.sendMail({
      from: fromAddress,
      to: ownerEmail,
      subject: `New booking: ${fullName || 'Unknown contact'}`,
      html: ownerHtml,
    }),
  ];

  await Promise.all(mailJobs);
};

const buildBookingLink = (token) => {
  const baseUrl = process.env.ONBOARDING_PORTAL_URL || 'http://localhost:3000';
  return `${baseUrl}/booking?token=${token}`;
};

const createMeetingLinkRecord = async ({
  workspaceId,
  title = 'Discovery Call',
  durationMinutes = 45,
  timezone = 'Africa/Addis_Ababa',
}) => {
  const token = crypto.randomBytes(24).toString('hex');
  const meetingLinkId = generateId('meeting_link');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

  await db.insert(meetingLinks).values({
    id: meetingLinkId,
    workspaceId,
    token,
    status: 'OPEN',
    title,
    durationMinutes,
    timezone,
    expiresAt,
    updatedAt: new Date(),
  });

  return { token, link: buildBookingLink(token) };
};

router.post('/public', async (req, res, next) => {
  try {
    const { workspaceId } = req.body || {};
    if (!workspaceId) {
      return res.status(400).json({ message: 'workspaceId is required' });
    }

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const result = await createMeetingLinkRecord({ workspaceId });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/lookup', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: 'token is required' });

    const [linkRecord] = await db
      .select()
      .from(meetingLinks)
      .where(eq(meetingLinks.token, token))
      .limit(1);

    if (!linkRecord) {
      return res.status(404).json({ message: 'Booking link not found' });
    }

    if (linkRecord.status !== 'OPEN') {
      return res
        .status(400)
        .json({ message: 'Booking link is no longer active' });
    }

    if (new Date(linkRecord.expiresAt) < new Date()) {
      return res.status(400).json({ message: 'Booking link expired' });
    }

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, linkRecord.workspaceId))
      .limit(1);

    res.json({
      workspaceId: linkRecord.workspaceId,
      workspaceName: workspace?.name || null,
      durationMinutes: linkRecord.durationMinutes,
      timezone: linkRecord.timezone,
      title: linkRecord.title,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/submit', async (req, res, next) => {
  try {
    const { token, payload } = req.body || {};
    if (!token) return res.status(400).json({ message: 'token is required' });

    const [linkRecord] = await db
      .select()
      .from(meetingLinks)
      .where(eq(meetingLinks.token, token))
      .limit(1);

    if (!linkRecord) {
      return res.status(404).json({ message: 'Booking link not found' });
    }

    if (linkRecord.status !== 'OPEN') {
      return res
        .status(400)
        .json({ message: 'Booking link is no longer active' });
    }

    if (new Date(linkRecord.expiresAt) < new Date()) {
      return res.status(400).json({ message: 'Booking link expired' });
    }

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, linkRecord.workspaceId))
      .limit(1);

    const firstName = toSafeString(payload?.first_name);
    const lastName = toSafeString(payload?.last_name);
    const phone = toSafeString(payload?.phone);
    const email = toSafeString(payload?.email);
    const websiteUrl = toSafeString(payload?.website_url);
    const businessType = toSafeString(payload?.business_type);
    const targetAudience = toSafeString(payload?.target_audience);
    const monthlyRevenue = toSafeString(payload?.monthly_revenue);
    const decisionMaker = toSafeString(payload?.decision_maker);
    const timezone = toSafeString(payload?.timezone) || linkRecord.timezone;
    const scheduledAtValue = toSafeString(payload?.scheduled_at);

    if (!firstName || !lastName || !phone || !email || !scheduledAtValue) {
      return res.status(400).json({
        message:
          'first_name, last_name, phone, email and scheduled_at are required',
      });
    }

    const scheduledAt = new Date(scheduledAtValue);
    if (Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ message: 'Invalid scheduled_at value' });
    }

    const durationMinutes =
      Number(payload?.duration_minutes) > 0
        ? Number(payload.duration_minutes)
        : linkRecord.durationMinutes;

    const scheduledEndAt = new Date(
      scheduledAt.getTime() + durationMinutes * 60 * 1000
    );

    const meetingId = generateId('meeting');
    await db.transaction(async (tx) => {
      await tx.insert(meetings).values({
        id: meetingId,
        workspaceId: linkRecord.workspaceId,
        meetingLinkId: linkRecord.id,
        status: 'SCHEDULED',
        firstName,
        lastName,
        phone,
        email,
        websiteUrl: websiteUrl || null,
        businessType: businessType || null,
        targetAudience: targetAudience || null,
        monthlyRevenue: monthlyRevenue || null,
        decisionMaker: decisionMaker || null,
        scheduledAt,
        scheduledEndAt,
        timezone,
        durationMinutes,
        payload: payload || {},
        updatedAt: new Date(),
      });

      await tx
        .update(meetingLinks)
        .set({
          status: 'BOOKED',
          updatedAt: new Date(),
        })
        .where(eq(meetingLinks.id, linkRecord.id));
    });

    try {
      await sendMeetingBookingEmails({
        workspaceName: workspace?.name || null,
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
      });
    } catch (emailError) {
      console.error('Failed to send meeting booking emails:', emailError);
    }

    res.json({ message: 'Meeting scheduled', meetingId });
  } catch (error) {
    next(error);
  }
});

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) {
      return res.status(400).json({ message: 'workspaceId is required' });
    }

    const admin =
      req.user.role === 'ADMIN' ||
      (await isWorkspaceAdmin(req.user.id, workspaceId));
    if (!admin) return res.status(403).json({ message: 'Forbidden' });

    const list = await db
      .select()
      .from(meetings)
      .where(eq(meetings.workspaceId, workspaceId))
      .orderBy(desc(meetings.scheduledAt));

    res.json(list);
  } catch (error) {
    next(error);
  }
});

router.delete('/:meetingId', async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    if (!meetingId) {
      return res.status(400).json({ message: 'meetingId is required' });
    }

    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId))
      .limit(1);

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const admin =
      req.user.role === 'ADMIN' ||
      (await isWorkspaceAdmin(req.user.id, meeting.workspaceId));
    if (!admin) return res.status(403).json({ message: 'Forbidden' });

    await db.transaction(async (tx) => {
      await tx.delete(meetings).where(eq(meetings.id, meeting.id));
      if (meeting.meetingLinkId) {
        await tx
          .update(meetingLinks)
          .set({
            status: 'OPEN',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(meetingLinks.id, meeting.meetingLinkId),
              eq(meetingLinks.status, 'BOOKED')
            )
          );
      }
    });

    res.json({
      message: 'Meeting deleted',
      id: meeting.id,
      workspaceId: meeting.workspaceId,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
