import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { emailDispatches } from '../db/schema.js';
import { sendEmail } from '../lib/email.js';
import { generateId } from '../lib/ids.js';
import { qstashReceiver } from '../lib/qstash.js';

const router = Router();

const getRequestUrl = (req) => {
  const baseUrl =
    process.env.BACKEND_BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    `${req.protocol}://${req.get('host')}`;
  return `${baseUrl.replace(/\/$/, '')}${req.originalUrl}`;
};

const verifyQstashSignature = async (req) => {
  const signature = req.get('Upstash-Signature') || req.get('upstash-signature');
  if (!signature) {
    return false;
  }

  const body = req.body?.toString('utf8') || '';
  const url = getRequestUrl(req);
  return qstashReceiver.verify({
    signature,
    body,
    url,
  });
};

export const sendEmailHandler = async (req, res, next) => {
  try {
    const isVerified = await verifyQstashSignature(req);
    if (!isVerified) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const payload = JSON.parse(req.body?.toString('utf8') || '{}');
    const { to, subject, text, idempotencyKey, meetingId, emailType } = payload;

    if (!to || !subject || !text || !idempotencyKey) {
      return res.status(400).json({
        message: 'to, subject, text, and idempotencyKey are required',
      });
    }

    const [existing] = await db
      .select({ id: emailDispatches.id })
      .from(emailDispatches)
      .where(eq(emailDispatches.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existing) {
      return res.json({ message: 'Email already processed' });
    }

    const providerResponse = await sendEmail({
      to,
      subject,
      text,
    });

    await db.insert(emailDispatches).values({
      id: generateId('email_dispatch'),
      idempotencyKey,
      meetingId: meetingId || null,
      emailType: emailType || null,
      recipient: to,
      providerMessageId: providerResponse?.id || null,
      sentAt: new Date(),
      createdAt: new Date(),
    });

    return res.json({ message: 'Email sent' });
  } catch (error) {
    if (error?.name === 'SignatureError') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    return next(error);
  }
};

router.post('/send-email', sendEmailHandler);

export default router;
