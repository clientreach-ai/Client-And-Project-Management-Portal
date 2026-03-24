import { Router } from 'express';
import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { meetingLinks, meetings, workspaces } from '../db/schema.js';
import { generateId } from '../lib/ids.js';
import { sendMeetingBookingEmails } from '../lib/meetingNotifications.js';
import { requireAuth } from '../middleware/auth.js';
import { isWorkspaceAdmin } from '../lib/permissions.js';
import { createZoomMeeting, cancelZoomMeeting } from '../lib/zoom.js';
import {
  cancelScheduledEmails,
  scheduleEmails,
} from '../lib/bookingScheduler.js';

const router = Router();
const BOOKING_TIMEZONE = 'Europe/London';
const DEFAULT_BOOKING_START_HOUR = 9;
const DEFAULT_BOOKING_END_HOUR = 20;

const toSafeString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeHour = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const intValue = Math.trunc(parsed);
  if (intValue < 0 || intValue > 23) return fallback;
  return intValue;
};

const resolveBookingWindow = (settings = {}) => {
  const rawWindow = settings?.bookingWindow || {};
  let startHour = normalizeHour(
    rawWindow.startHour,
    DEFAULT_BOOKING_START_HOUR
  );
  let endHour = normalizeHour(rawWindow.endHour, DEFAULT_BOOKING_END_HOUR);

  if (startHour > endHour) {
    [startHour, endHour] = [endHour, startHour];
  }

  return { startHour, endHour };
};

const getHourInTimezone = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  return Number(parts.find((part) => part.type === 'hour')?.value || 0);
};

const buildBookingLink = (token) => {
  const baseUrl =
    process.env.APP_BASE_URL ||
    process.env.ONBOARDING_PORTAL_URL ||
    'http://localhost:5173';
  return `${baseUrl}/booking?token=${token}`;
};

const createMeetingLinkRecord = async ({
  workspaceId,
  title = 'Discovery Call',
  durationMinutes = 45,
  timezone = BOOKING_TIMEZONE,
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
      timezone: BOOKING_TIMEZONE,
      title: linkRecord.title,
      ...resolveBookingWindow(workspace?.settings),
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
    const bookingWindow = resolveBookingWindow(workspace?.settings);

    const firstName = toSafeString(payload?.first_name);
    const lastName = toSafeString(payload?.last_name);
    const phone = toSafeString(payload?.phone);
    const email = toSafeString(payload?.email);
    const websiteUrl = toSafeString(payload?.website_url);
    const businessType = toSafeString(payload?.business_type);
    const targetAudience = toSafeString(payload?.target_audience);
    const monthlyRevenue = toSafeString(payload?.monthly_revenue);
    const decisionMaker = toSafeString(payload?.decision_maker);
    const timezone = BOOKING_TIMEZONE;
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

    const scheduledHour = getHourInTimezone(scheduledAt, BOOKING_TIMEZONE);
    if (
      scheduledHour < bookingWindow.startHour ||
      scheduledHour > bookingWindow.endHour
    ) {
      return res.status(400).json({
        message: `Selected time must be between ${bookingWindow.startHour}:00 and ${bookingWindow.endHour}:00 ${BOOKING_TIMEZONE}`,
      });
    }

    const durationMinutes =
      Number(payload?.duration_minutes) > 0
        ? Number(payload.duration_minutes)
        : linkRecord.durationMinutes;
    const meetingId = generateId('meeting');

    const scheduledEndAt = new Date(
      scheduledAt.getTime() + durationMinutes * 60 * 1000
    );
    const zoomMeeting = await createZoomMeeting({
      topic: linkRecord.title || 'Discovery Call',
      startTimeUtc: scheduledAt,
      durationMinutes,
    });

    let scheduledMessageIds = [];

    try {
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
          zoomMeetingId: zoomMeeting.zoomMeetingId,
          zoomJoinUrl: zoomMeeting.joinUrl,
          zoomStartUrl: zoomMeeting.startUrl,
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

      const scheduledJobs = await scheduleEmails({
        meetingId,
        attendeeEmail: email,
        zoomLink: zoomMeeting.joinUrl,
        scheduledAt,
        booking: {
          workspaceName: workspace?.name || null,
          firstName,
          lastName,
          attendeeEmail: email,
          phone,
          timezone,
          durationMinutes,
          scheduledAt,
          websiteUrl,
          businessType,
          targetAudience,
          monthlyRevenue,
          decisionMaker,
        },
      });

      scheduledMessageIds = Object.values(scheduledJobs).filter(Boolean);

      await db
        .update(meetings)
        .set({
          ...scheduledJobs,
          updatedAt: new Date(),
        })
        .where(eq(meetings.id, meetingId));
    } catch (error) {
      console.error('Booking flow failed, rolling back external resources:', error);

      await cancelScheduledEmails(scheduledMessageIds);

      await cancelZoomMeeting(zoomMeeting.zoomMeetingId).catch((zoomError) => {
        console.error('Failed to cancel Zoom meeting after booking failure:', zoomError);
      });

      await db.transaction(async (tx) => {
        await tx.delete(meetings).where(eq(meetings.id, meetingId));
        await tx
          .update(meetingLinks)
          .set({
            status: 'OPEN',
            updatedAt: new Date(),
          })
          .where(eq(meetingLinks.id, linkRecord.id));
      });

      throw error;
    }

    res.json({
      message: 'Meeting scheduled',
      meetingId,
    });
  } catch (error) {
    next(error);
  }
});

router.use(requireAuth);

router.get('/settings', async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) {
      return res.status(400).json({ message: 'workspaceId is required' });
    }

    const admin =
      req.user.role === 'ADMIN' ||
      (await isWorkspaceAdmin(req.user.id, workspaceId));
    if (!admin) return res.status(403).json({ message: 'Forbidden' });

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    res.json({
      workspaceId,
      ...resolveBookingWindow(workspace.settings),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/settings', async (req, res, next) => {
  try {
    const { workspaceId, startHour, endHour } = req.body || {};
    if (!workspaceId) {
      return res.status(400).json({ message: 'workspaceId is required' });
    }

    const admin =
      req.user.role === 'ADMIN' ||
      (await isWorkspaceAdmin(req.user.id, workspaceId));
    if (!admin) return res.status(403).json({ message: 'Forbidden' });

    const normalizedStartHour = normalizeHour(startHour, NaN);
    const normalizedEndHour = normalizeHour(endHour, NaN);
    if (
      !Number.isFinite(normalizedStartHour) ||
      !Number.isFinite(normalizedEndHour)
    ) {
      return res.status(400).json({
        message: 'startHour and endHour must be integers between 0 and 23',
      });
    }

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }

    const settings = workspace.settings || {};
    const nextWindow = {
      startHour: Math.min(normalizedStartHour, normalizedEndHour),
      endHour: Math.max(normalizedStartHour, normalizedEndHour),
    };

    await db
      .update(workspaces)
      .set({
        settings: {
          ...settings,
          bookingWindow: nextWindow,
        },
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId));

    res.json({ workspaceId, ...nextWindow });
  } catch (error) {
    next(error);
  }
});

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

    await cancelScheduledEmails([
      meeting.qstashClientReminder1hMessageId,
      meeting.qstashClientReminder30mMessageId,
      meeting.qstashClientReminder5mMessageId,
      meeting.qstashOwnerReminder1hMessageId,
      meeting.qstashOwnerReminder30mMessageId,
      meeting.qstashOwnerReminder5mMessageId,
    ]);

    await cancelZoomMeeting(meeting.zoomMeetingId).catch((zoomError) => {
      console.error('Failed to cancel Zoom meeting:', zoomError);
    });

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
