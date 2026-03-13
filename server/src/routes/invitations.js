import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  clients,
  invitations,
  projectMembers,
  users,
  workspaceMembers,
} from '../db/schema.js';
import { generateId } from '../lib/ids.js';
import { requireAuth } from '../middleware/auth.js';
import { isWorkspaceAdmin } from '../lib/permissions.js';
import { getEmailFromAddress, isEmailConfigured, sendEmail } from '../lib/email.js';

const router = Router();

const stripSensitive = (user) => {
  if (!user) return user;
  const { password_hash, ...safeUser } = user;
  return safeUser;
};

const buildInviteLink = (token) => {
  const baseUrl = process.env.APP_BASE_URL;
  return `${baseUrl}/accept-invite?token=${token}`;
};

router.get('/lookup', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: 'token is required' });

    const [invite] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    if (!invite) return res.status(404).json({ message: 'Invite not found' });
    if (invite.acceptedAt) {
      return res.status(400).json({ message: 'Invite already accepted' });
    }

    if (new Date(invite.expiresAt) < new Date()) {
      return res.status(400).json({ message: 'Invite expired' });
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, invite.email))
      .limit(1);

    res.json({
      email: invite.email,
      role: invite.role,
      workspaceId: invite.workspaceId,
      projectId: invite.projectId,
      userExists: Boolean(existingUser?.id),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/test', (req, res) => {
  return res.json({ message: 'Invitations route is working' });
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { email, role, workspaceId, projectId } = req.body;

    if (!email || !role || !workspaceId) {
      return res
        .status(400)
        .json({ message: 'email, role, and workspaceId are required' });
    }

    const normalizedRole = role?.toUpperCase();
    if (
      !['GLOBAL_ADMIN', 'ADMIN', 'MEMBER', 'CLIENT'].includes(normalizedRole)
    ) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    if (normalizedRole === 'MEMBER' && !projectId) {
      return res
        .status(400)
        .json({ message: 'projectId is required for member invites' });
    }

    const isGlobalAdmin = req.user.role === 'ADMIN';
    const isWorkspaceAdminRole = await isWorkspaceAdmin(
      req.user.id,
      workspaceId
    );
    const isAdmin = isGlobalAdmin || isWorkspaceAdminRole;
    if (!isAdmin) return res.status(403).json({ message: 'Forbidden' });

    if (normalizedRole === 'GLOBAL_ADMIN' && !isGlobalAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const inviteId = generateId('invite');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    await db.insert(invitations).values({
      id: inviteId,
      email: email.toLowerCase(),
      token,
      role: normalizedRole,
      workspaceId,
      projectId: normalizedRole === 'MEMBER' ? projectId : null,
      invitedBy: req.user.id,
      expiresAt,
    });

    const inviteLink = buildInviteLink(token);

    console.log('Invite Link:', inviteLink);

    let emailSent = false;
    let emailError = null;

    if (!isEmailConfigured()) {
      emailError = 'RESEND_API_KEY is not configured';
    } else {
      try {
        await sendEmail({
          from: getEmailFromAddress(),
          to: email,
          subject: 'You have been invited to a workspace',
          html: `
            <p>You have been invited to join a workspace.</p>
            <p><a href="${inviteLink}">Accept invitation</a></p>
            <p>If the link does not work, copy and paste this URL:</p>
            <p>${inviteLink}</p>
          `,
        });
        emailSent = true;
      } catch (err) {
        emailError = err?.message || 'Failed to send invite email';
        console.error('Invite email error:', err);
      }
    }

    const payload = {
      message: emailSent
        ? 'Invitation sent'
        : 'Invitation created (email not sent)',
    };

    if (emailError) {
      payload.emailError = emailError;
    }

    if (process.env.NODE_ENV !== 'production') {
      payload.inviteLink = inviteLink;
    }

    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
});

router.post('/accept', async (req, res, next) => {
  try {
    const { token, password, name } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'token is required' });
    }

    const [invite] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    if (!invite) return res.status(404).json({ message: 'Invite not found' });
    if (invite.acceptedAt) {
      return res.status(400).json({ message: 'Invite already accepted' });
    }

    if (new Date(invite.expiresAt) < new Date()) {
      return res.status(400).json({ message: 'Invite expired' });
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, invite.email))
      .limit(1);

    let userId = existingUser?.id;
    const isGlobalAdminInvite = invite.role === 'GLOBAL_ADMIN';
    const isClientInvite = invite.role === 'CLIENT';
    const workspaceRole = isClientInvite
      ? 'CLIENT'
      : invite.role === 'MEMBER'
        ? 'MEMBER'
        : 'ADMIN';

    if (!existingUser) {
      if (!password) {
        return res.status(400).json({ message: 'password is required' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const finalRole = isClientInvite
        ? 'CLIENT'
        : isGlobalAdminInvite
          ? 'ADMIN'
          : 'USER';
      userId = generateId('user');
      await db.insert(users).values({
        id: userId,
        name: name || invite.email.split('@')[0],
        email: invite.email,
        password_hash: passwordHash,
        role: finalRole,
      });
    } else if (isGlobalAdminInvite && existingUser.role !== 'ADMIN') {
      await db
        .update(users)
        .set({ role: 'ADMIN', updatedAt: new Date() })
        .where(eq(users.id, existingUser.id));
    } else if (isClientInvite && existingUser.role === 'USER') {
      await db
        .update(users)
        .set({ role: 'CLIENT', updatedAt: new Date() })
        .where(eq(users.id, existingUser.id));
    } else if (!existingUser.password_hash && password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await db
        .update(users)
        .set({ password_hash: passwordHash })
        .where(eq(users.id, existingUser.id));
    } else if (existingUser.password_hash && password) {
      const isValid = await bcrypt.compare(
        password,
        existingUser.password_hash
      );
      if (!isValid) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
    }

    const [existingMembership] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, invite.workspaceId),
          eq(workspaceMembers.userId, userId)
        )
      )
      .limit(1);

    if (!existingMembership) {
      const memberId = generateId('wm');
      await db.insert(workspaceMembers).values({
        id: memberId,
        workspaceId: invite.workspaceId,
        userId,
        role: workspaceRole,
        message: '',
      });
    } else if (existingMembership.role !== workspaceRole) {
      await db
        .update(workspaceMembers)
        .set({ role: workspaceRole })
        .where(eq(workspaceMembers.id, existingMembership.id));
    }

    if (invite.projectId) {
      const [existingProjectMember] = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, invite.projectId),
            eq(projectMembers.userId, userId)
          )
        )
        .limit(1);

      if (!existingProjectMember) {
        const projectMemberId = generateId('pm');
        await db.insert(projectMembers).values({
          id: projectMemberId,
          projectId: invite.projectId,
          userId,
        });
      }
    }

    await db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invite.id));

    if (isClientInvite) {
      await db
        .update(clients)
        .set({ portalUserId: userId, updatedAt: new Date() })
        .where(
          and(
            eq(clients.email, invite.email),
            eq(clients.portalWorkspaceId, invite.workspaceId)
          )
        );
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const safeUser = stripSensitive(user);

    if (existingUser?.id) {
      return res.json({
        existingUser: true,
        user: safeUser,
        workspaceId: invite.workspaceId,
      });
    }

    const jwt = (await import('jsonwebtoken')).default;
    const tokenValue = jwt.sign(
      { sub: safeUser.id, email: safeUser.email, role: safeUser.role },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    return res.json({
      token: tokenValue,
      user: safeUser,
      workspaceId: invite.workspaceId,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/decline', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'token is required' });
    }

    const [invite] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    if (!invite) return res.status(404).json({ message: 'Invite not found' });
    if (invite.acceptedAt) {
      return res.status(400).json({ message: 'Invite already accepted' });
    }

    await db.delete(invitations).where(eq(invitations.id, invite.id));
    return res.json({ message: 'Invitation declined' });
  } catch (error) {
    next(error);
  }
});

export default router;
