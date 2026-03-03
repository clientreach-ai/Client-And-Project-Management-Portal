import { useMemo } from 'react';
import { Copy, ExternalLink, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { useWorkspaceContext } from '../context/workspaceContext';
import { useMeetings } from '../hooks/useQueries';
import { useDeleteMeeting } from '../hooks/useMutations';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const Bookings = () => {
  const user = useSelector((state) => state.auth.user);
  const { currentWorkspace } = useWorkspaceContext();

  const memberRole = currentWorkspace?.members?.find(
    (member) => member.user.id === user?.id
  )?.role;
  const isAdmin = user?.role === 'ADMIN' || memberRole === 'ADMIN';

  const workspaceId = currentWorkspace?.id || null;

  const { data: meetings = [], isLoading } = useMeetings(workspaceId, {
    enabled: Boolean(workspaceId && isAdmin),
  });
  const { mutateAsync: deleteMeeting, isPending: deletingMeeting } =
    useDeleteMeeting();

  const publicBookingUrl = workspaceId
    ? `${window.location.origin}/booking?workspaceId=${encodeURIComponent(
        workspaceId
      )}`
    : '';

  const sortedMeetings = useMemo(() => {
    return [...meetings].sort((a, b) => {
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [meetings]);

  const copyLink = async () => {
    if (!publicBookingUrl) {
      toast.error('Workspace is required');
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicBookingUrl);
      }
      toast.success('Booking link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const deleteBooking = async (meeting) => {
    if (!meeting?.id || !workspaceId) return;

    const confirmed = window.confirm(
      `Delete booking for ${meeting.firstName} ${meeting.lastName}?`
    );
    if (!confirmed) return;

    try {
      await deleteMeeting({
        meetingId: meeting.id,
        workspaceId,
      });
      toast.success('Booking deleted');
    } catch (error) {
      toast.error(error?.message || 'Failed to delete booking');
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <h2 className="text-xl font-semibold">Bookings Access</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
          Only workspace admins can manage bookings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
          Bookings
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Copy your booking page link and manage all scheduled meetings.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Public Booking Link
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 break-all">
              {publicBookingUrl || 'Select a workspace to generate link'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded border border-zinc-300 dark:border-zinc-700"
            >
              <Copy className="w-4 h-4" />
              Copy Link
            </button>
            <a
              href={publicBookingUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm rounded border ${
                publicBookingUrl
                  ? 'border-zinc-300 dark:border-zinc-700'
                  : 'border-zinc-200 text-zinc-400 pointer-events-none dark:border-zinc-800'
              }`}
            >
              <ExternalLink className="w-4 h-4" />
              Open
            </a>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <p className="text-sm font-semibold">All Bookings</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {sortedMeetings.length} total
          </p>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
            Loading bookings...
          </div>
        ) : sortedMeetings.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
            No bookings yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/70 text-zinc-600 dark:text-zinc-300">
                <tr>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Contact</th>
                  <th className="text-left p-3">Business</th>
                  <th className="text-left p-3">Scheduled</th>
                  <th className="text-left p-3">Timezone</th>
                  <th className="text-left p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedMeetings.map((meeting) => (
                  <tr
                    key={meeting.id}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="p-3">
                      {meeting.firstName} {meeting.lastName}
                    </td>
                    <td className="p-3">
                      <div>{meeting.email}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {meeting.phone}
                      </div>
                    </td>
                    <td className="p-3">
                      <div>{meeting.businessType || 'N/A'}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {meeting.websiteUrl || 'No website'}
                      </div>
                    </td>
                    <td className="p-3">{formatDate(meeting.scheduledAt)}</td>
                    <td className="p-3">{meeting.timezone || 'N/A'}</td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => deleteBooking(meeting)}
                        disabled={deletingMeeting}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-600 border border-red-200 dark:border-red-900/40 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Bookings;
