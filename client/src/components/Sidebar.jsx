import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MyTasksSidebar from './MyTasksSidebar';
import ProjectSidebar from './ProjectsSidebar';
import WorkspaceDropdown from './WorkspaceDropdown';
import {
  BarChart3Icon,
  BriefcaseIcon,
  CalendarIcon,
  CalendarPlusIcon,
  CheckSquareIcon,
  FileTextIcon,
  FolderOpenIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react';
import { useWorkspaceContext } from '../context/workspaceContext';

const Sidebar = ({ isSidebarOpen, setIsSidebarOpen }) => {
  const user = useSelector((state) => state.auth.user);
  const { currentWorkspace } = useWorkspaceContext();
  const memberRole = currentWorkspace?.members?.find(
    (m) => m.user.id === user?.id
  )?.role;
  const isAdmin = user?.role === 'ADMIN' || memberRole === 'ADMIN';
  const isClient = user?.role === 'CLIENT';
  const clientProjectId = currentWorkspace?.projects?.[0]?.id || null;
  const analyticsHref = clientProjectId
    ? `/projects/${clientProjectId}/analytics`
    : '/projects';
  const calendarHref = clientProjectId
    ? `/projects/${clientProjectId}/calendar`
    : '/projects';

  const menuItems = isClient
    ? [
        {
          name: 'Dashboard',
          href: '/',
          icon: LayoutDashboardIcon,
          exact: true,
        },
        {
          name: 'Projects',
          href: '/projects',
          icon: FolderOpenIcon,
          exact: true,
        },
        {
          name: 'Files & Links',
          href: '/client-files',
          icon: FileTextIcon,
          exact: true,
        },
        {
          name: 'Invoices',
          href: '/client-invoices',
          icon: WalletIcon,
          exact: true,
        },
        {
          name: 'Messages',
          href: '/client-messages',
          icon: MessageSquareIcon,
          exact: true,
        },
        { name: 'Analytics', href: analyticsHref, icon: BarChart3Icon },
        { name: 'Calendar', href: calendarHref, icon: CalendarIcon },
      ]
    : [
        {
          name: 'Dashboard',
          href: '/',
          icon: LayoutDashboardIcon,
          exact: true,
        },
        {
          name: 'My Tasks',
          href: '/my-tasks',
          icon: CheckSquareIcon,
          exact: true,
        },
        {
          name: 'Projects',
          href: '/projects',
          icon: FolderOpenIcon,
          exact: true,
        },
        ...(isAdmin
          ? [
              { name: 'Team', href: '/team', icon: UsersIcon, exact: true },
              {
                name: 'Clients',
                href: '/clients',
                icon: BriefcaseIcon,
                exact: true,
              },
              {
                name: 'Leads',
                href: '/leads',
                icon: FileTextIcon,
                exact: true,
              },
              {
                name: 'Bookings',
                href: '/bookings',
                icon: CalendarPlusIcon,
                exact: true,
              },
            ]
          : []),
      ];

  const sidebarRef = useRef(null);

  const handleNavClick = () => {
    if (window.matchMedia('(max-width: 640px)').matches) {
      setIsSidebarOpen(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setIsSidebarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsSidebarOpen]);

  return (
    <div
      ref={sidebarRef}
      className={`z-30 bg-white dark:bg-zinc-900 w-68 flex flex-col h-screen border-r border-gray-200 dark:border-zinc-800 fixed top-0 left-0 max-sm:shadow-lg transition-transform max-sm:duration-300 ${isSidebarOpen ? 'max-sm:translate-x-0' : 'max-sm:-translate-x-full'} `}
    >
      <WorkspaceDropdown />
      <hr className="border-gray-200 dark:border-zinc-800" />
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
        <div>
          <div className="p-4">
            {menuItems.map((item) => (
              <NavLink
                to={item.href}
                key={item.name}
                onClick={handleNavClick}
                end={Boolean(item.exact)}
                className={({ isActive }) =>
                  `flex items-center gap-3 py-2 px-4 text-gray-800 dark:text-zinc-100 cursor-pointer rounded transition-all  ${isActive ? 'bg-gray-100 dark:bg-zinc-900 dark:bg-linear-to-br dark:from-zinc-800 dark:to-zinc-800/50  dark:ring-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/60'}`
                }
              >
                <item.icon size={16} />
                <p className="text-sm truncate">{item.name}</p>
              </NavLink>
            ))}
          </div>
          {!isClient && <MyTasksSidebar />}
          {!isClient && <ProjectSidebar />}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
