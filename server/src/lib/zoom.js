const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';

const getRequiredZoomEnv = () => {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      'ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET are required'
    );
  }

  return { accountId, clientId, clientSecret };
};

const getZoomAccessToken = async () => {
  const { accountId, clientId, clientSecret } = getRequiredZoomEnv();
  const authorization = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64'
  );

  const response = await fetch(
    `${ZOOM_TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authorization}`,
      },
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to get Zoom access token: ${details}`);
  }

  const payload = await response.json();
  return payload.access_token;
};

export const createZoomMeeting = async ({ topic, startTimeUtc, durationMinutes }) => {
  const accessToken = await getZoomAccessToken();

  const response = await fetch(`${ZOOM_API_BASE_URL}/users/me/meetings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: topic || 'Discovery Call',
      type: 2,
      start_time: startTimeUtc.toISOString(),
      duration: durationMinutes,
      timezone: 'UTC',
      settings: {
        waiting_room: true,
        join_before_host: false,
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to create Zoom meeting: ${details}`);
  }

  const payload = await response.json();
  return {
    zoomMeetingId: String(payload.id),
    joinUrl: payload.join_url,
    startUrl: payload.start_url || null,
  };
};

export const cancelZoomMeeting = async (zoomMeetingId) => {
  if (!zoomMeetingId) return;

  const accessToken = await getZoomAccessToken();
  const response = await fetch(
    `${ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(zoomMeetingId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const details = await response.text();
    throw new Error(`Failed to cancel Zoom meeting: ${details}`);
  }
};
