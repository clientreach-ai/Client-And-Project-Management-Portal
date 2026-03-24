const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
  'ZOOM_ACCOUNT_ID',
  'ZOOM_CLIENT_ID',
  'ZOOM_CLIENT_SECRET',
];

const REQUIRED_ONE_OF_GROUPS = [
  ['BACKEND_BASE_URL', 'RENDER_EXTERNAL_URL'],
];

const isSet = (value) => typeof value === 'string' && value.trim().length > 0;

export const validateRequiredEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !isSet(process.env[key]));

  const missingGroups = REQUIRED_ONE_OF_GROUPS.filter(
    (group) => !group.some((key) => isSet(process.env[key]))
  );

  if (!missing.length && !missingGroups.length) {
    return;
  }

  const lines = ['Missing required environment variables:'];

  if (missing.length) {
    lines.push(`- ${missing.join(', ')}`);
  }

  for (const group of missingGroups) {
    lines.push(`- one of: ${group.join(' or ')}`);
  }

  lines.push('Set these in server/.env and restart the server.');

  throw new Error(lines.join('\n'));
};
