import { useQuery } from '@tanstack/react-query';
import {
  fetchProjectById,
  fetchTaskById,
  fetchTaskComments,
  fetchWorkspaceById,
  fetchWorkspaces,
  lookupInvitation,
  fetchClients,
  fetchClientIntakes,
  fetchLeadIntakes,
  lookupClientIntake,
  fetchSharedFiles,
  fetchMessages,
  fetchInvoices,
  fetchInvoiceById,
  fetchLeadResources,
  fetchMeetings,
  lookupMeetingLink,
} from '../api';
import {
  clientKeys,
  intakeKeys,
  leadIntakeKeys,
  leadResourceKeys,
  projectKeys,
  taskKeys,
  workspaceKeys,
  fileKeys,
  messageKeys,
  invoiceKeys,
  meetingKeys,
} from './queryKeys';

export const useWorkspaces = (options = {}) =>
  useQuery({
    queryKey: workspaceKeys.all,
    queryFn: fetchWorkspaces,
    staleTime: 1000 * 30,
    ...options,
  });

export const useWorkspace = (id, options = {}) =>
  useQuery({
    queryKey: workspaceKeys.detail(id),
    queryFn: () => fetchWorkspaceById(id),
    enabled: Boolean(id),
    ...options,
  });

export const useProject = (id, options = {}) =>
  useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => fetchProjectById(id),
    enabled: Boolean(id),
    ...options,
  });

export const useTask = (id, options = {}) =>
  useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => fetchTaskById(id),
    enabled: Boolean(id),
    ...options,
  });

export const useTaskComments = (id, options = {}) =>
  useQuery({
    queryKey: taskKeys.comments(id),
    queryFn: () => fetchTaskComments(id),
    enabled: Boolean(id),
    refetchInterval: 10000,
    ...options,
  });

export const useInvitationLookup = (token, options = {}) =>
  useQuery({
    queryKey: ['invitation', token],
    queryFn: () => lookupInvitation(token),
    enabled: Boolean(token),
    ...options,
  });

export const useClients = (workspaceId, options = {}) =>
  useQuery({
    queryKey: clientKeys.list(workspaceId),
    queryFn: () => fetchClients(workspaceId),
    enabled: Boolean(workspaceId),
    ...options,
  });

export const useClientIntakes = (workspaceId, options = {}) =>
  useQuery({
    queryKey: intakeKeys.list(workspaceId),
    queryFn: () => fetchClientIntakes(workspaceId),
    enabled: Boolean(workspaceId),
    ...options,
  });

export const useLeadIntakes = (workspaceId, options = {}) =>
  useQuery({
    queryKey: leadIntakeKeys.list(workspaceId),
    queryFn: () => fetchLeadIntakes(workspaceId),
    enabled: Boolean(workspaceId),
    ...options,
  });

export const useClientIntakeLookup = (token, options = {}) =>
  useQuery({
    queryKey: intakeKeys.lookup(token),
    queryFn: () => lookupClientIntake(token),
    enabled: Boolean(token),
    ...options,
  });

export const useLeadResources = (workspaceId, options = {}) =>
  useQuery({
    queryKey: leadResourceKeys.list(workspaceId),
    queryFn: () => fetchLeadResources(workspaceId),
    enabled: Boolean(workspaceId),
    ...options,
  });

export const useMeetings = (workspaceId, options = {}) =>
  useQuery({
    queryKey: meetingKeys.list(workspaceId),
    queryFn: () => fetchMeetings(workspaceId),
    enabled: Boolean(workspaceId),
    ...options,
  });

export const useMeetingLinkLookup = (token, options = {}) =>
  useQuery({
    queryKey: meetingKeys.lookup(token),
    queryFn: () => lookupMeetingLink(token),
    enabled: Boolean(token),
    ...options,
  });

export const useSharedFiles = (
  { workspaceId, clientId, projectId } = {},
  options = {}
) =>
  useQuery({
    queryKey: fileKeys.list(workspaceId, clientId, projectId),
    queryFn: () => fetchSharedFiles({ workspaceId, clientId, projectId }),
    enabled: Boolean(workspaceId),
    ...options,
  });

export const useMessages = (workspaceId, options = {}) =>
  useQuery({
    queryKey: messageKeys.list(workspaceId),
    queryFn: () => fetchMessages(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: 8000,
    ...options,
  });

export const useInvoicesByWorkspace = (workspaceId, options = {}) =>
  useQuery({
    queryKey: invoiceKeys.listByWorkspace(workspaceId),
    queryFn: () => fetchInvoices({ workspaceId }),
    enabled: Boolean(workspaceId),
    ...options,
  });

export const useInvoicesByClient = (clientId, options = {}) =>
  useQuery({
    queryKey: invoiceKeys.listByClient(clientId),
    queryFn: () => fetchInvoices({ clientId }),
    enabled: Boolean(clientId),
    ...options,
  });

export const useInvoice = (invoiceId, options = {}) =>
  useQuery({
    queryKey: invoiceKeys.detail(invoiceId),
    queryFn: () => fetchInvoiceById(invoiceId),
    enabled: Boolean(invoiceId),
    ...options,
  });
