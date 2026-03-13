import { Router } from 'express';
import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  clientIntakes,
  leadIntakes,
  clients,
  sharedFiles,
  workspaces,
} from '../db/schema.js';
import { generateId } from '../lib/ids.js';
import { requireAuth } from '../middleware/auth.js';
import { isWorkspaceAdmin } from '../lib/permissions.js';
import { getEmailFromAddress, isEmailConfigured, sendEmail } from '../lib/email.js';

const router = Router();
const LEAD_RESOURCE_TYPE = 'LEAD_RESOURCE';

const buildIntakeLink = (token) => {
  const baseUrl = process.env.ONBOARDING_PORTAL_URL || 'http://localhost:3000';
  return `${baseUrl}/intake?token=${token}`;
};

const createIntakeRecord = async ({ workspaceId, clientId = null }) => {
  const token = crypto.randomBytes(24).toString('hex');
  const intakeId = generateId('intake');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

  await db.insert(clientIntakes).values({
    id: intakeId,
    workspaceId,
    clientId,
    token,
    status: 'OPEN',
    expiresAt,
  });

  return { token, link: buildIntakeLink(token) };
};

const toSafeString = (value) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeSourceKey = (value) =>
  toSafeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildLeadResourceEmailHtml = (name, downloadUrl) => `
<html><body style="margin:0;padding:0;background:#f0f8ff;font-family:Arial,sans-serif;"><table width="100%" style="background:#f0f8ff;padding:40px 20px;"><tr><td align="center"><table width="600" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(20,163,246,0.08);"><tr><td style="background:#ffffff;padding:32px 40px;text-align:center;border-bottom:3px solid #14A3F6;"><table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="font-size:26px;font-weight:800;color:#0a2540;font-family:Arial,sans-serif;">Client<span style="color:#14A3F6;">Reach</span>.ai</td></tr></table></td></tr><tr><td style="padding:36px 40px;"><p style="color:#0a2540;font-size:18px;font-weight:600;margin:0 0 18px;">Hey ${escapeHtml(name)},</p><p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 24px;">Thanks for signing up. Here's the resource you requested &mdash; no fluff, just actionable strategies to grow with AI.</p><p style="text-align:center;margin:0 0 28px;"><a href="${escapeHtml(downloadUrl)}" style="background:#14A3F6;color:#ffffff;text-decoration:none;padding:15px 40px;border-radius:50px;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 4px 16px rgba(20,163,246,0.35);letter-spacing:0.3px;">Download Now &rarr;</a></p><p style="color:#4a5568;font-size:14px;line-height:1.6;margin:0;">Got questions? Just reply to this email.</p><p style="color:#0a2540;font-size:14px;margin:22px 0 0;">Talk soon,<br><strong>The ClientReach.ai Team</strong></p></td></tr><tr><td style="background:#f8fbff;padding:18px 40px;text-align:center;border-top:1px solid #e8f0fe;"><p style="color:#94a3b8;font-size:11px;margin:0;">&copy; 2026 ClientReach.ai &mdash; Scale Your Business, Not Your Headcount.</p></td></tr></table></td></tr></table></body></html>
`;

const sendLeadResourceEmail = async ({ name, email, downloadUrl }) => {
  if (!isEmailConfigured()) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const safeName = toSafeString(name) || 'there';

  await sendEmail({
    from: getEmailFromAddress(),
    to: email,
    subject: `Your free resource is ready, ${safeName}`,
    html: buildLeadResourceEmailHtml(safeName, downloadUrl),
  });
};

const resolveLeadSourceKey = (payload = {}) => {
  const explicitSrc = normalizeSourceKey(payload?.src);
  const businessModelSrc = normalizeSourceKey(payload?.business_model);
  return explicitSrc || businessModelSrc || null;
};

const findLeadResourceBySource = async ({ workspaceId, sourceKey }) => {
  if (!workspaceId || !sourceKey) return null;

  const [resource] = await db
    .select()
    .from(sharedFiles)
    .where(
      and(
        eq(sharedFiles.workspaceId, workspaceId),
        eq(sharedFiles.type, LEAD_RESOURCE_TYPE),
        eq(sharedFiles.name, sourceKey)
      )
    )
    .orderBy(desc(sharedFiles.updatedAt))
    .limit(1);

  return resource || null;
};

const isLeadCapturePayload = (payload = {}) => {
  const name = toSafeString(payload?.name);
  const email = toSafeString(payload?.email);
  const hasLeadSignals =
    Boolean(payload?.src) ||
    Boolean(payload?.business_model) ||
    Boolean(payload?.biggest_bottleneck);
  return Boolean(name && email && hasLeadSignals);
};

router.post('/public', async (req, res, next) => {
  try {
    const { workspaceId } = req.body;
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

    const result = await createIntakeRecord({ workspaceId });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/lookup', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: 'token is required' });

    const [intake] = await db
      .select()
      .from(clientIntakes)
      .where(eq(clientIntakes.token, token))
      .limit(1);

    if (!intake) return res.status(404).json({ message: 'Intake not found' });
    if (intake.status !== 'OPEN') {
      return res.status(400).json({ message: 'Intake already submitted' });
    }
    if (new Date(intake.expiresAt) < new Date()) {
      return res.status(400).json({ message: 'Intake expired' });
    }

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, intake.workspaceId))
      .limit(1);

    const [client] = intake.clientId
      ? await db
          .select()
          .from(clients)
          .where(eq(clients.id, intake.clientId))
          .limit(1)
      : [];

    res.json({
      workspaceId: intake.workspaceId,
      workspaceName: workspace?.name || null,
      clientId: intake.clientId,
      clientName: client?.name || null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/submit', async (req, res, next) => {
  try {
    const { token, payload } = req.body;
    if (!token) return res.status(400).json({ message: 'token is required' });

    const [intake] = await db
      .select()
      .from(clientIntakes)
      .where(eq(clientIntakes.token, token))
      .limit(1);

    if (!intake) return res.status(404).json({ message: 'Intake not found' });
    if (intake.status !== 'OPEN') {
      return res.status(400).json({ message: 'Intake already submitted' });
    }
    if (new Date(intake.expiresAt) < new Date()) {
      return res.status(400).json({ message: 'Intake expired' });
    }

    const rawPayload = payload || {};
    const leadSourceKey = resolveLeadSourceKey(rawPayload);
    const payloadWithSource = leadSourceKey
      ? { ...rawPayload, src: leadSourceKey }
      : rawPayload;

    const intakeSource =
      payloadWithSource?.source === 'PUBLIC' ? 'PUBLIC' : 'INTAKE';
    const normalizedContactName =
      payloadWithSource?.contact_name ||
      payloadWithSource?.name ||
      payloadWithSource?.clientName ||
      null;
    const normalizedServiceType =
      payloadWithSource?.service_type || payloadWithSource?.business_model || null;

    const isLeadSubmission = isLeadCapturePayload(payloadWithSource);
    if (isLeadSubmission) {
      const leadName = toSafeString(payloadWithSource?.name);
      const leadEmail = toSafeString(payloadWithSource?.email);

      if (!leadSourceKey) {
        return res.status(400).json({
          message:
            'Lead source is required. Add ?src= in the link or select a business model.',
        });
      }

      const resource = await findLeadResourceBySource({
        workspaceId: intake.workspaceId,
        sourceKey: leadSourceKey,
      });

      if (!resource?.url) {
        return res.status(400).json({
          message: `No resource file is configured for source "${leadSourceKey}".`,
        });
      }

      try {
        await sendLeadResourceEmail({
          name: leadName,
          email: leadEmail,
          downloadUrl: resource.url,
        });
      } catch (error) {
        console.error('[client-intakes] lead email send failed:', error);
        return res.status(502).json({
          message: 'Failed to send resource email. Please try again.',
        });
      }

      const leadId = generateId('lead');
      await db.insert(leadIntakes).values({
        id: leadId,
        workspaceId: intake.workspaceId,
        intakeId: intake.id,
        status: 'SUBMITTED',
        name: leadName || 'Unknown',
        email: leadEmail,
        phone: toSafeString(payloadWithSource?.phone) || null,
        businessModel: toSafeString(payloadWithSource?.business_model) || null,
        sourceKey: leadSourceKey,
        biggestBottleneck:
          toSafeString(payloadWithSource?.biggest_bottleneck) || null,
        payload: payloadWithSource,
        submittedAt: new Date(),
        updatedAt: new Date(),
      });

      await db
        .update(clientIntakes)
        .set({
          serviceType: normalizedServiceType,
          companyName:
            payloadWithSource?.company_name || payloadWithSource?.company || null,
          contactName: normalizedContactName,
          contactRole: payloadWithSource?.contact_role || null,
          industry: payloadWithSource?.industry || null,
          businessDetails: payloadWithSource?.business_details || {},
          serviceResponses: payloadWithSource?.service_responses || {},
          uploadedFiles: payloadWithSource?.uploaded_files || [],
          calendlyEventId: payloadWithSource?.calendly_event_id || null,
          payload: payloadWithSource,
          status: 'LEAD_SUBMITTED',
          submittedAt: new Date(),
          clientId: intake.clientId || null,
        })
        .where(eq(clientIntakes.id, intake.id));

      return res.json({ message: 'Intake submitted', leadId });
    }

    let clientId = intake.clientId || null;

    if (!clientId) {
      const newClientId = generateId('client');
      const name =
        normalizedContactName ||
        payloadWithSource?.company_name ||
        payloadWithSource?.company ||
        'Client';
      const website =
        payloadWithSource?.company_website ||
        payloadWithSource?.website ||
        payloadWithSource?.service_responses?.current_url ||
        null;

      await db.insert(clients).values({
        id: newClientId,
        workspaceId: intake.workspaceId,
        name,
        company: payloadWithSource?.company_name || payloadWithSource?.company || null,
        contactName: normalizedContactName,
        contactRole: payloadWithSource?.contact_role || null,
        email: payloadWithSource?.email || null,
        phone: payloadWithSource?.phone || null,
        website,
        industry: payloadWithSource?.industry || null,
        serviceType: normalizedServiceType,
        businessDetails: payloadWithSource?.business_details || {},
        serviceResponses: payloadWithSource?.service_responses || {},
        uploadedFiles: payloadWithSource?.uploaded_files || [],
        calendlyEventId: payloadWithSource?.calendly_event_id || null,
        details: {
          source: intakeSource,
          intakeId: intake.id,
          serviceType: normalizedServiceType,
          sourceKey: leadSourceKey,
          businessModel: payloadWithSource?.business_model || null,
          biggestBottleneck: payloadWithSource?.biggest_bottleneck || null,
          contactRole: payloadWithSource?.contact_role || null,
          businessDetails: payloadWithSource?.business_details || null,
          serviceResponses: payloadWithSource?.service_responses || null,
          uploadedFiles: payloadWithSource?.uploaded_files || null,
          calendlyEventId: payloadWithSource?.calendly_event_id || null,
          projectName: payloadWithSource?.projectName || null,
          goals: payloadWithSource?.goals || null,
          budget: payloadWithSource?.budget || null,
          timeline: payloadWithSource?.timeline || null,
          targetAudience: payloadWithSource?.targetAudience || null,
          brandGuidelines: payloadWithSource?.brandGuidelines || null,
          competitors: payloadWithSource?.competitors || null,
          successMetrics: payloadWithSource?.successMetrics || null,
          notes: payloadWithSource?.notes || null,
        },
        updatedAt: new Date(),
      });

      clientId = newClientId;
    }

    await db
      .update(clientIntakes)
      .set({
        serviceType: normalizedServiceType,
        companyName:
          payloadWithSource?.company_name || payloadWithSource?.company || null,
        contactName: normalizedContactName,
        contactRole: payloadWithSource?.contact_role || null,
        industry: payloadWithSource?.industry || null,
        businessDetails: payloadWithSource?.business_details || {},
        serviceResponses: payloadWithSource?.service_responses || {},
        uploadedFiles: payloadWithSource?.uploaded_files || [],
        calendlyEventId: payloadWithSource?.calendly_event_id || null,
        payload: payloadWithSource,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        clientId,
      })
      .where(eq(clientIntakes.id, intake.id));

    res.json({ message: 'Intake submitted', clientId });
  } catch (error) {
    next(error);
  }
});

router.use(requireAuth);

router.get('/leads', async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) {
      return res.status(400).json({ message: 'workspaceId is required' });
    }

    const admin =
      req.user.role === 'ADMIN' ||
      (await isWorkspaceAdmin(req.user.id, workspaceId));
    if (!admin) return res.status(403).json({ message: 'Forbidden' });

    const leads = await db
      .select()
      .from(leadIntakes)
      .where(eq(leadIntakes.workspaceId, workspaceId))
      .orderBy(desc(leadIntakes.submittedAt));

    res.json(
      leads.map((lead) => ({
        ...lead,
        payload: lead.payload || {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          business_model: lead.businessModel,
          src: lead.sourceKey,
          biggest_bottleneck: lead.biggestBottleneck,
        },
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.delete('/leads/:leadId', async (req, res, next) => {
  try {
    const { leadId } = req.params;
    if (!leadId) {
      return res.status(400).json({ message: 'leadId is required' });
    }

    const [lead] = await db
      .select()
      .from(leadIntakes)
      .where(eq(leadIntakes.id, leadId))
      .limit(1);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const admin =
      req.user.role === 'ADMIN' ||
      (await isWorkspaceAdmin(req.user.id, lead.workspaceId));
    if (!admin) return res.status(403).json({ message: 'Forbidden' });

    await db.transaction(async (tx) => {
      await tx.delete(leadIntakes).where(eq(leadIntakes.id, lead.id));
      if (lead.intakeId) {
        await tx
          .delete(clientIntakes)
          .where(eq(clientIntakes.id, lead.intakeId));
      }
    });

    res.json({
      message: 'Lead deleted',
      id: lead.id,
      workspaceId: lead.workspaceId,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/resources', async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) {
      return res.status(400).json({ message: 'workspaceId is required' });
    }

    const admin =
      req.user.role === 'ADMIN' ||
      (await isWorkspaceAdmin(req.user.id, workspaceId));
    if (!admin) return res.status(403).json({ message: 'Forbidden' });

    const resources = await db
      .select()
      .from(sharedFiles)
      .where(
        and(
          eq(sharedFiles.workspaceId, workspaceId),
          eq(sharedFiles.type, LEAD_RESOURCE_TYPE)
        )
      )
      .orderBy(desc(sharedFiles.updatedAt));

    res.json(
      resources.map((item) => ({
        ...item,
        sourceKey: item.name,
        label: item?.metadata?.label || item.name,
      }))
    );
  } catch (error) {
    next(error);
  }
});

router.post('/resources', async (req, res, next) => {
  try {
    const { workspaceId, name, url, size, mimeType, cloudinaryPublicId } =
      req.body || {};

    if (!workspaceId || !name || !url) {
      return res
        .status(400)
        .json({ message: 'workspaceId, name and url are required' });
    }

    const admin =
      req.user.role === 'ADMIN' ||
      (await isWorkspaceAdmin(req.user.id, workspaceId));
    if (!admin) return res.status(403).json({ message: 'Forbidden' });

    const sourceKey = normalizeSourceKey(name);
    if (!sourceKey) {
      return res
        .status(400)
        .json({ message: 'name must include letters or numbers' });
    }

    const [existing] = await db
      .select()
      .from(sharedFiles)
      .where(
        and(
          eq(sharedFiles.workspaceId, workspaceId),
          eq(sharedFiles.type, LEAD_RESOURCE_TYPE),
          eq(sharedFiles.name, sourceKey)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(sharedFiles)
        .set({
          url,
          size: size || null,
          mimeType: mimeType || null,
          cloudinaryPublicId: cloudinaryPublicId || existing.cloudinaryPublicId,
          metadata: {
            ...(existing.metadata || {}),
            label: toSafeString(name),
            sourceKey,
          },
          updatedAt: new Date(),
        })
        .where(eq(sharedFiles.id, existing.id));

      const [updated] = await db
        .select()
        .from(sharedFiles)
        .where(eq(sharedFiles.id, existing.id))
        .limit(1);

      return res.status(200).json({
        ...updated,
        sourceKey: updated.name,
        label: updated?.metadata?.label || updated.name,
      });
    }

    const fileId = generateId('file');
    await db.insert(sharedFiles).values({
      id: fileId,
      workspaceId,
      clientId: null,
      projectId: null,
      name: sourceKey,
      type: LEAD_RESOURCE_TYPE,
      url,
      size: size || null,
      mimeType: mimeType || null,
      cloudinaryPublicId: cloudinaryPublicId || null,
      uploadedBy: req.user.id,
      metadata: {
        label: toSafeString(name),
        sourceKey,
      },
      updatedAt: new Date(),
    });

    const [created] = await db
      .select()
      .from(sharedFiles)
      .where(eq(sharedFiles.id, fileId))
      .limit(1);

    res.status(201).json({
      ...created,
      sourceKey: created.name,
      label: created?.metadata?.label || created.name,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/resources/:resourceId', async (req, res, next) => {
  try {
    const { resourceId } = req.params;
    if (!resourceId) {
      return res.status(400).json({ message: 'resourceId is required' });
    }

    const [resource] = await db
      .select()
      .from(sharedFiles)
      .where(
        and(
          eq(sharedFiles.id, resourceId),
          eq(sharedFiles.type, LEAD_RESOURCE_TYPE)
        )
      )
      .limit(1);

    if (!resource) {
      return res.status(404).json({ message: 'Lead resource not found' });
    }

    const admin =
      req.user.role === 'ADMIN' ||
      (await isWorkspaceAdmin(req.user.id, resource.workspaceId));
    if (!admin) return res.status(403).json({ message: 'Forbidden' });

    await db.delete(sharedFiles).where(eq(sharedFiles.id, resource.id));

    res.json({
      message: 'Lead resource deleted',
      id: resource.id,
      workspaceId: resource.workspaceId,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:intakeId', async (req, res, next) => {
  try {
    const { intakeId } = req.params;
    if (!intakeId) {
      return res.status(400).json({ message: 'intakeId is required' });
    }

    const [intake] = await db
      .select()
      .from(clientIntakes)
      .where(eq(clientIntakes.id, intakeId))
      .limit(1);

    if (!intake) {
      return res.status(404).json({ message: 'Lead intake not found' });
    }

    const admin =
      req.user.role === 'ADMIN' ||
      (await isWorkspaceAdmin(req.user.id, intake.workspaceId));
    if (!admin) return res.status(403).json({ message: 'Forbidden' });

    await db.transaction(async (tx) => {
      await tx.delete(leadIntakes).where(eq(leadIntakes.intakeId, intake.id));
      await tx.delete(clientIntakes).where(eq(clientIntakes.id, intake.id));
    });

    res.json({
      message: 'Lead deleted',
      id: intake.id,
      workspaceId: intake.workspaceId,
    });
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
      .from(clientIntakes)
      .where(eq(clientIntakes.workspaceId, workspaceId));

    res.json(list);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { workspaceId, clientId } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ message: 'workspaceId is required' });
    }

    const admin =
      req.user.role === 'ADMIN' ||
      (await isWorkspaceAdmin(req.user.id, workspaceId));
    if (!admin) return res.status(403).json({ message: 'Forbidden' });

    const result = await createIntakeRecord({
      workspaceId,
      clientId: clientId || null,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
