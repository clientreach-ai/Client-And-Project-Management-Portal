import { Resend } from 'resend';

const resend = new Resend(
  process.env.RESEND_API_KEY || process.env.RESEND_API_KEEY
);

export const isEmailConfigured = () =>
  Boolean(
    process.env.RESEND_API_KEY || process.env.RESEND_API_KEEY
  );

export const getEmailFromAddress = () => {
  const from = process.env.EMAIL_FROM_RESOURCE || process.env.EMAIL_FROM;
  if (from && from.includes('@')) {
    return from.includes('<') ? from : `ClientReach.ai <${from}>`;
  }
  return from || 'ClientReach.ai <onboarding@resend.dev>';
};

export const getOwnerEmail = () =>
  process.env.OWNER_EMAIL || process.env.EMAIL_USER;

export const sendEmail = async ({ from, to, subject, html, text }) => {
  if (!html && !text) {
    throw new Error('Either html or text is required to send email');
  }

  const { data, error } = await resend.emails.send({
    from: from || getEmailFromAddress(),
    to: Array.isArray(to) ? to : [to],
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
  });
  if (error) throw new Error(error.message);
  return data;
};
