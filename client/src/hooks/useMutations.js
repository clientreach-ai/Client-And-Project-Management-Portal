import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addTaskComment,
  addProjectMember,
  createProject,
  createTask,
  createUser,
  createWorkspace,
  deleteTask,
  acceptInvitation,
  sendInvitation,
  fetchUserByEmail,
  login,
  declineInvitation,
  createClient,
  updateClient,
  createClientIntake,
  deleteClientIntake,
  deleteLeadIntake,
  submitClientIntake,
  updateProject,
  updateTask,
  updateUser,
  updateWorkspace,
  deleteWorkspace,
  createPublicClientIntake,
  createProjectClientInvite,
  createSharedFile,
  createFileSignature,
  createMessage,
  createInvoice,
  updateInvoice,
  createInvoiceCheckoutSession,
  createLeadResource,
  deleteLeadResource,
  createPublicMeetingLink,
  submitMeetingBooking,
  deleteMeeting,
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

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      if (created?.id) {
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.detail(created.id),
        });
      }
    },
  });
};

export const useCreatePublicClientIntake = () =>
  useMutation({
    mutationFn: createPublicClientIntake,
  });

export const useUpdateWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, payload }) =>
      updateWorkspace(workspaceId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.detail(variables.workspaceId),
      });
    },
  });
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId }) => deleteWorkspace(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload, teamMemberEmails = [], teamLeadEmail }) => {
      const uniqueEmails = Array.from(new Set(teamMemberEmails)).filter(
        Boolean
      );

      const teamMemberIds = await Promise.all(
        uniqueEmails.map(async (email) => {
          const existing = await fetchUserByEmail(email);
          if (existing?.id) return existing.id;
          const name = email.split('@')[0];
          const created = await createUser({ name, email });
          return created.id;
        })
      );

      let teamLeadId = null;
      if (teamLeadEmail) {
        const lead = await fetchUserByEmail(teamLeadEmail);
        if (lead?.id) teamLeadId = lead.id;
      }

      const project = await createProject({
        ...payload,
        team_lead: teamLeadId,
      });

      if (teamMemberIds.length) {
        await Promise.all(
          teamMemberIds.map((userId) =>
            addProjectMember(project.id, { userId })
          )
        );
      }

      return project;
    },
    onSuccess: (created, variables) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      const workspaceId = created?.workspaceId || variables?.workspaceId;
      if (workspaceId) {
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.detail(workspaceId),
        });
      }
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, payload }) => updateProject(projectId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: projectKeys.detail(variables.projectId),
      });
      if (variables?.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.detail(variables.workspaceId),
        });
      }
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};

export const useCreateProjectClientInvite = () =>
  useMutation({
    mutationFn: ({ projectId }) => createProjectClientInvite(projectId),
  });

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, payload }) => createTask(projectId, payload),
    onSuccess: (created, variables) => {
      if (created?.projectId) {
        queryClient.invalidateQueries({
          queryKey: projectKeys.detail(created.projectId),
        });
      }
      if (variables?.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.detail(variables.workspaceId),
        });
      }
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, payload }) => updateTask(taskId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.detail(variables.taskId),
      });
      if (variables?.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.detail(variables.workspaceId),
        });
      }
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};

export const useDeleteTasks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskIds }) =>
      Promise.all(taskIds.map((id) => deleteTask(id))),
    onSuccess: (_, variables) => {
      if (variables?.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.detail(variables.workspaceId),
        });
      }
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};

export const useAddTaskComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, payload }) => addTaskComment(taskId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.comments(variables.taskId),
      });
    },
  });
};

export const useSendInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendInvitation,
    onSuccess: (_, variables) => {
      if (variables?.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.detail(variables.workspaceId),
        });
      }
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};

export const useCreateSharedFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSharedFile,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: fileKeys.list(
          variables.workspaceId,
          variables.clientId,
          variables.projectId
        ),
      });
    },
  });
};

export const useCreateFileSignature = () =>
  useMutation({
    mutationFn: createFileSignature,
  });

export const useCreateMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMessage,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: messageKeys.list(variables.workspaceId),
      });
    },
  });
};

export const useAcceptInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};

export const useDeclineInvitation = () =>
  useMutation({
    mutationFn: declineInvitation,
  });

export const useLogin = () =>
  useMutation({
    mutationFn: ({ email, password }) => login({ email, password }),
  });

export const useAddProjectMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, payload, email }) => {
      if (payload?.userId) {
        return addProjectMember(projectId, payload);
      }
      if (!email) {
        throw new Error('User email is required');
      }
      const user = await fetchUserByEmail(email);
      if (!user?.id) {
        throw new Error('User not found');
      }
      return addProjectMember(projectId, { userId: user.id });
    },
    onSuccess: (_, variables) => {
      if (variables?.projectId) {
        queryClient.invalidateQueries({
          queryKey: projectKeys.detail(variables.projectId),
        });
      }
      if (variables?.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.detail(variables.workspaceId),
        });
      }
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }) => updateUser(userId, payload),
    onSuccess: (_, variables) => {
      if (variables?.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.detail(variables.workspaceId),
        });
      }
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};

export const useCreateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createClient,
    onSuccess: (created) => {
      if (created?.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: clientKeys.list(created.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.detail(created.workspaceId),
        });
      }
    },
  });
};

export const useUpdateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, payload }) => updateClient(clientId, payload),
    onSuccess: (updated) => {
      if (updated?.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: clientKeys.list(updated.workspaceId),
        });
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.detail(updated.workspaceId),
        });
      }
    },
  });
};

export const useCreateClientIntake = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createClientIntake,
    onSuccess: (_, variables) => {
      if (variables?.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: intakeKeys.list(variables.workspaceId),
        });
      }
    },
  });
};

export const useDeleteClientIntake = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ intakeId }) => deleteClientIntake(intakeId),
    onSuccess: (deleted, variables) => {
      const workspaceId = deleted?.workspaceId || variables?.workspaceId;
      if (workspaceId) {
        queryClient.invalidateQueries({
          queryKey: intakeKeys.list(workspaceId),
        });
      }
    },
  });
};

export const useDeleteLeadIntake = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId }) => deleteLeadIntake(leadId),
    onSuccess: (deleted, variables) => {
      const workspaceId = deleted?.workspaceId || variables?.workspaceId;
      if (workspaceId) {
        queryClient.invalidateQueries({
          queryKey: leadIntakeKeys.list(workspaceId),
        });
      }
    },
  });
};

export const useCreateLeadResource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createLeadResource,
    onSuccess: (created, variables) => {
      const workspaceId = created?.workspaceId || variables?.workspaceId;
      if (workspaceId) {
        queryClient.invalidateQueries({
          queryKey: leadResourceKeys.list(workspaceId),
        });
      }
    },
  });
};

export const useDeleteLeadResource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ resourceId }) => deleteLeadResource(resourceId),
    onSuccess: (deleted, variables) => {
      const workspaceId = deleted?.workspaceId || variables?.workspaceId;
      if (workspaceId) {
        queryClient.invalidateQueries({
          queryKey: leadResourceKeys.list(workspaceId),
        });
      }
    },
  });
};

export const useSubmitClientIntake = () =>
  useMutation({
    mutationFn: submitClientIntake,
  });

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: (created) => {
      if (created?.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.listByWorkspace(created.workspaceId),
        });
      }
      if (created?.clientId) {
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.listByClient(created.clientId),
        });
      }
    },
  });
};

export const useUpdateInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, payload }) => updateInvoice(invoiceId, payload),
    onSuccess: (updated) => {
      if (!updated?.id) return;
      queryClient.invalidateQueries({
        queryKey: invoiceKeys.detail(updated.id),
      });
      if (updated.workspaceId) {
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.listByWorkspace(updated.workspaceId),
        });
      }
      if (updated.clientId) {
        queryClient.invalidateQueries({
          queryKey: invoiceKeys.listByClient(updated.clientId),
        });
      }
    },
  });
};

export const useCreateInvoiceCheckoutSession = () =>
  useMutation({
    mutationFn: ({ invoiceId }) => createInvoiceCheckoutSession(invoiceId),
  });

export const useCreatePublicMeetingLink = () =>
  useMutation({
    mutationFn: createPublicMeetingLink,
  });

export const useSubmitMeetingBooking = () =>
  useMutation({
    mutationFn: submitMeetingBooking,
  });

export const useDeleteMeeting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ meetingId }) => deleteMeeting(meetingId),
    onSuccess: (deleted, variables) => {
      const workspaceId = deleted?.workspaceId || variables?.workspaceId;
      if (workspaceId) {
        queryClient.invalidateQueries({
          queryKey: meetingKeys.list(workspaceId),
        });
      }
    },
  });
};
