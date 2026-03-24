import {
  getEmailFromAddress,
  getOwnerEmail,
  isEmailConfigured,
  sendEmail,
} from "./email.js";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildBrandedEmailShell = ({ greeting, intro, content, ctaLabel }) => `
<html><body style="margin:0;padding:0;background:#f0f8ff;font-family:Arial,sans-serif;"><table width="100%" style="background:#f0f8ff;padding:40px 20px;"><tr><td align="center"><table width="600" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(20,163,246,0.08);"><tr><td style="background:#ffffff;padding:32px 40px;text-align:center;border-bottom:3px solid #14A3F6;"><table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="font-size:26px;font-weight:800;color:#0a2540;font-family:Arial,sans-serif;">Client<span style="color:#14A3F6;">Reach</span>.ai</td></tr></table></td></tr><tr><td style="padding:36px 40px;"><p style="color:#0a2540;font-size:18px;font-weight:600;margin:0 0 18px;">${greeting}</p><p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 24px;">${intro}</p>${content}<p style="color:#4a5568;font-size:14px;line-height:1.6;margin:24px 0 0;">${ctaLabel || "If you need anything before the call, just reply to this email."}</p><p style="color:#0a2540;font-size:14px;margin:22px 0 0;">Talk soon,<br><strong>The ClientReach.ai Team</strong></p></td></tr><tr><td style="background:#f8fbff;padding:18px 40px;text-align:center;border-top:1px solid #e8f0fe;"><p style="color:#94a3b8;font-size:11px;margin:0;">&copy; 2026 ClientReach.ai &mdash; Scale Your Business, Not Your Headcount.</p></td></tr></table></td></tr></table></body></html>
`;

const buildClientBookingSummaryCard = ({
  formattedDate,
  timezone,
  durationMinutes,
  zoomLink,
  extraNote,
}) => `
  <div style="background:#f8fbff;border:1px solid #e8f0fe;border-radius:14px;padding:22px 24px;margin:0 0 24px;">
    <p style="margin:0 0 10px;color:#0a2540;font-size:14px;font-weight:700;letter-spacing:0.2px;">Your call details</p>
    <p style="margin:0 0 8px;color:#4a5568;font-size:14px;line-height:1.6;"><strong style="color:#0a2540;">Date &amp; time:</strong> ${escapeHtml(formattedDate)}</p>
    <p style="margin:0 0 8px;color:#4a5568;font-size:14px;line-height:1.6;"><strong style="color:#0a2540;">Time zone:</strong> ${escapeHtml(timezone || "N/A")}</p>
    <p style="margin:0;color:#4a5568;font-size:14px;line-height:1.6;"><strong style="color:#0a2540;">Duration:</strong> ${escapeHtml(String(durationMinutes || "N/A"))} minutes</p>
    ${zoomLink ? `<p style="margin:8px 0 0;color:#4a5568;font-size:14px;line-height:1.6;"><strong style="color:#0a2540;">Join link:</strong> <a href="${escapeHtml(zoomLink)}">${escapeHtml(zoomLink)}</a></p>` : ""}
  </div>
  ${extraNote ? `<p style="color:#4a5568;font-size:14px;line-height:1.7;margin:0;">${extraNote}</p>` : ""}
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
    <p style="margin: 0 0 4px;"><strong>Name:</strong> ${escapeHtml(fullName || "N/A")}</p>
    <p style="margin: 0 0 4px;"><strong>Email:</strong> ${escapeHtml(email || "N/A")}</p>
    <p style="margin: 0 0 4px;"><strong>Phone:</strong> ${escapeHtml(phone || "N/A")}</p>
    <p style="margin: 0 0 4px;"><strong>Website:</strong> ${escapeHtml(websiteUrl || "N/A")}</p>
    <p style="margin: 0 0 4px;"><strong>Business Type:</strong> ${escapeHtml(businessType || "N/A")}</p>
    <p style="margin: 0 0 4px;"><strong>Target Audience:</strong> ${escapeHtml(targetAudience || "N/A")}</p>
    <p style="margin: 0 0 4px;"><strong>Monthly Revenue:</strong> ${escapeHtml(monthlyRevenue || "N/A")}</p>
    <p style="margin: 0 0 4px;"><strong>Decision Maker:</strong> ${escapeHtml(decisionMaker || "N/A")}</p>
    <p style="margin: 0 0 4px;"><strong>Workspace:</strong> ${escapeHtml(workspaceName || "N/A")}</p>
    <p style="margin: 0 0 4px;"><strong>Date &amp; Time:</strong> ${escapeHtml(formattedDate)}</p>
    <p style="margin: 0 0 4px;"><strong>Timezone:</strong> ${escapeHtml(timezone || "N/A")}</p>
    <p style="margin: 0;"><strong>Duration:</strong> ${escapeHtml(String(durationMinutes || "N/A"))} minutes</p>
  </div>
`;

const reminderLabelFromType = (emailType = "") => {
  if (emailType.includes("1_HOUR")) return "1 hour";
  if (emailType.includes("30_MINUTES")) return "30 minutes";
  if (emailType.includes("5_MINUTES")) return "5 minutes";
  return null;
};

const buildReminderTextSummary = ({
  fullName,
  attendeeEmail,
  phone,
  workspaceName,
  formattedDate,
  timezone,
  durationMinutes,
  websiteUrl,
  businessType,
  targetAudience,
  monthlyRevenue,
  decisionMaker,
  zoomLink,
  includeLink,
  reminderLabel,
}) => {
  const lines = [
    ` Upcoming meeting in ${reminderLabel} `,
    "",
    `Client: ${fullName || "N/A"}`,
    `Client Email: ${attendeeEmail || "N/A"}`,
    `Phone: ${phone || "N/A"}`,
    `Workspace: ${workspaceName || "N/A"}`,
    `Date/Time: ${formattedDate}`,
    `Timezone: ${timezone || "N/A"}`,
    `Duration: ${durationMinutes || "N/A"} minutes`,
    `Website: ${websiteUrl || "N/A"}`,
    `Business Type: ${businessType || "N/A"}`,
    `Target Audience: ${targetAudience || "N/A"}`,
    `Monthly Revenue: ${monthlyRevenue || "N/A"}`,
    `Decision Maker: ${decisionMaker || "N/A"}`,
  ];

  if (includeLink && zoomLink) {
    lines.push("", `Join link: ${zoomLink}`);
  }

  return lines.join("\n");
};

export const buildReminderEmailContent = ({
  emailType,
  booking = {},
  zoomLink,
}) => {
  const reminderLabel = reminderLabelFromType(emailType);
  if (!reminderLabel) return null;

  const isOwner = emailType.startsWith("OWNER_");
  const includeLink = emailType.includes("5_MINUTES");

  const firstName = booking.firstName || "";
  const lastName = booking.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const attendeeEmail = booking.attendeeEmail || booking.email || null;
  const timezone = booking.timezone || "Europe/London";
  const formattedDate = formatBookingDate(booking.scheduledAt, timezone);
  const durationMinutes = booking.durationMinutes;

  if (isOwner) {
    const ownerHtml = buildBrandedEmailShell({
      greeting: ` Upcoming meeting in ${escapeHtml(reminderLabel)} `,
      intro:
        "This is an internal booking reminder from Client Reach AI. Please review the meeting details below.",
      content:
        buildTechnicalBookingEmailHtml({
          heading: `Internal Reminder: meeting starts in ${escapeHtml(reminderLabel)}`,
          fullName,
          email: attendeeEmail,
          phone: booking.phone,
          websiteUrl: booking.websiteUrl,
          businessType: booking.businessType,
          targetAudience: booking.targetAudience,
          monthlyRevenue: booking.monthlyRevenue,
          decisionMaker: booking.decisionMaker,
          workspaceName: booking.workspaceName,
          formattedDate,
          timezone,
          durationMinutes,
        }) +
        (includeLink && zoomLink
          ? `<p style="margin:16px 0 0;font-size:14px;"><strong>Join link:</strong> <a href="${escapeHtml(zoomLink)}">${escapeHtml(zoomLink)}</a></p>`
          : ""),
      ctaLabel:
        "You will receive the next reminder automatically based on the meeting schedule.",
    });

    return {
      subject: `Reminder: ${fullName || "Client"} meeting starts in ${reminderLabel}`,
      html: ownerHtml,
      text: buildReminderTextSummary({
        fullName,
        attendeeEmail,
        phone: booking.phone,
        workspaceName: booking.workspaceName,
        formattedDate,
        timezone,
        durationMinutes,
        websiteUrl: booking.websiteUrl,
        businessType: booking.businessType,
        targetAudience: booking.targetAudience,
        monthlyRevenue: booking.monthlyRevenue,
        decisionMaker: booking.decisionMaker,
        zoomLink,
        includeLink,
        reminderLabel,
      }),
    };
  }

  const clientHtml = buildBrandedEmailShell({
    greeting: `Hey ${escapeHtml(firstName || "there")},`,
    intro: `This is a reminder that your meeting starts in ${escapeHtml(reminderLabel)}.`,
    content: buildClientBookingSummaryCard({
      formattedDate,
      timezone,
      durationMinutes,
      zoomLink: includeLink ? zoomLink : null,
      extraNote: includeLink
        ? "Your join link is now active above. Please join a few minutes early so we can start on time."
        : "You will receive your join link in the final reminder email sent 5 minutes before your call.",
    }),
    ctaLabel:
      "If you need to share an update before the call, reply to this email.",
  });

  return {
    subject: `Reminder: your meeting starts in ${reminderLabel}`,
    html: clientHtml,
    text: includeLink
      ? `Your meeting starts in ${reminderLabel}. Join link: ${zoomLink}`
      : `Your meeting starts in ${reminderLabel}. We will send your join link 5 minutes before your call.`,
  };
};

export const formatBookingDate = (scheduledAt, timezone) => {
  if (!scheduledAt) return "N/A";

  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return "N/A";

  try {
    return date.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone || undefined,
    });
  } catch {
    return date.toLocaleString();
  }
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
    throw new Error("RESEND_API_KEY is not configured");
  }

  const fromAddress = getEmailFromAddress();
  const ownerEmail = getOwnerEmail();
  const fullName = `${firstName} ${lastName}`.trim();
  const formattedDate = formatBookingDate(scheduledAt, timezone);
  const customerHtml = buildBrandedEmailShell({
    greeting: `Hey ${escapeHtml(firstName || "there")},`,
    intro:
      "Thank you for booking with Client Reach AI. Your session has been confirmed, and we look forward to speaking with you.",
    content: buildClientBookingSummaryCard({
      formattedDate,
      timezone,
      durationMinutes,
      extraNote:
        "You will receive reminder emails before your meeting. Your booking link will be shared in the final reminder email sent 5 minutes before the call.",
    }),
  });

  const ownerHtml = buildTechnicalBookingEmailHtml({
    heading: "New Booking Received 📅",
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

  const ownerBrandedHtml = buildBrandedEmailShell({
    greeting: "A new booking has been confirmed.",
    intro:
      "This is your internal confirmation from Client Reach AI. Review the details below and prepare for the meeting.",
    content: ownerHtml,
    ctaLabel:
      "Additional reminder emails will be sent before the meeting starts.",
  });

  await Promise.all([
    sendEmail({
      from: fromAddress,
      to: email,
      subject: "Your booking is confirmed",
      html: customerHtml,
    }),
    sendEmail({
      from: fromAddress,
      to: ownerEmail,
      subject: `New booking: ${fullName || "Unknown contact"}`,
      html: ownerBrandedHtml,
    }),
  ]);
};
