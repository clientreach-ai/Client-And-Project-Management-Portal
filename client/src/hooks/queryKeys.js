export const workspaceKeys = {
  all: ['workspaces'],
  detail: (id) => ['workspace', id],
};

export const projectKeys = {
  detail: (id) => ['project', id],
};

export const taskKeys = {
  detail: (id) => ['task', id],
  comments: (id) => ['taskComments', id],
};

export const clientKeys = {
  list: (workspaceId) => ['clients', workspaceId],
  detail: (id) => ['client', id],
};

export const intakeKeys = {
  list: (workspaceId) => ['clientIntakes', workspaceId],
  lookup: (token) => ['clientIntake', token],
};

export const leadResourceKeys = {
  list: (workspaceId) => ['leadResources', workspaceId],
};

export const leadIntakeKeys = {
  list: (workspaceId) => ['leadIntakes', workspaceId],
};

export const meetingKeys = {
  list: (workspaceId) => ['meetings', workspaceId],
  lookup: (token) => ['meetingLink', token],
};

export const fileKeys = {
  list: (workspaceId, clientId, projectId) => [
    'sharedFiles',
    workspaceId,
    clientId || null,
    projectId || null,
  ],
};

export const messageKeys = {
  list: (workspaceId) => ['messages', workspaceId],
};

export const invoiceKeys = {
  listByWorkspace: (workspaceId) => ['invoices', 'workspace', workspaceId],
  listByClient: (clientId) => ['invoices', 'client', clientId],
  detail: (invoiceId) => ['invoice', invoiceId],
};
