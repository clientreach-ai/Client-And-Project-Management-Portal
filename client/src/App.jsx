import { Routes, Route } from 'react-router-dom';
import Layout from './pages/Layout';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Team from './pages/Team';
import ProjectDetails from './pages/ProjectDetails';
import ProjectAnalyticsPage from './pages/ProjectAnalyticsPage';
import ProjectCalendarPage from './pages/ProjectCalendarPage';
import TaskDetails from './pages/TaskDetails';
import Settings from './pages/Settings';
import Login from './pages/Login';
import AcceptInvite from './pages/AcceptInvite';
import Clients from './pages/Clients';
import ClientIntake from './pages/ClientIntake';
import SalesFunnelIntake from './pages/SalesFunnelIntake';
import SimpleLeadIntake from './pages/SimpleLeadIntake';
import BookingForm from './pages/BookingForm';
import MyTasks from './pages/MyTasks';
import ClientFilesLinks from './pages/ClientFilesLinks';
import ClientInvoices from './pages/ClientInvoices';
import ClientMessages from './pages/ClientMessages';
import ClientDetails from './pages/ClientDetails';
import ClientCalendar from './pages/ClientCalendar';
import Leads from './pages/Leads';
import Bookings from './pages/Bookings';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useRef } from 'react';
import { loadAuthFromStorage } from './features/authSlice';
import { loadTheme } from './features/themeSlice';
import { useQueryClient } from '@tanstack/react-query';

const App = () => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { user, token, initialized } = useSelector((state) => state.auth);
  const prevUserId = useRef(null);

  useEffect(() => {
    dispatch(loadAuthFromStorage());
    dispatch(loadTheme());
  }, [dispatch]);

  useEffect(() => {
    if (!initialized) return;
    const nextUserId = user?.id || null;

    if (prevUserId.current && prevUserId.current !== nextUserId) {
      queryClient.clear();
    }

    if (!nextUserId && !token) {
      queryClient.clear();
    }

    if (nextUserId && token) {
      queryClient.invalidateQueries();
    }

    prevUserId.current = nextUserId;
  }, [initialized, user, token, queryClient]);

  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/client-intake" element={<ClientIntake />} />
        <Route path="/intake" element={<SalesFunnelIntake />} />
        <Route path="/intake-simple" element={<SimpleLeadIntake />} />
        <Route path="/booking" element={<BookingForm />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="team" element={<Team />} />
          <Route path="my-tasks" element={<MyTasks />} />
          <Route path="clients" element={<Clients />} />
          <Route path="leads" element={<Leads />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="clients/:id" element={<ClientDetails />} />
          <Route path="client-files" element={<ClientFilesLinks />} />
          <Route path="client-invoices" element={<ClientInvoices />} />
          <Route path="client-messages" element={<ClientMessages />} />
          <Route path="client-calendar" element={<ClientCalendar />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projectsDetail" element={<ProjectDetails />} />
          <Route
            path="projects/:id/analytics"
            element={<ProjectAnalyticsPage />}
          />
          <Route
            path="projects/:id/calendar"
            element={<ProjectCalendarPage />}
          />
          <Route path="taskDetails" element={<TaskDetails />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </>
  );
};

export default App;
