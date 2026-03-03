import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import usersRouter from './routes/users.js';
import workspacesRouter from './routes/workspaces.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import authRouter from './routes/auth.js';
import invitationsRouter from './routes/invitations.js';
import clientsRouter from './routes/clients.js';
import clientIntakesRouter from './routes/clientIntakes.js';
import filesRouter from './routes/files.js';
import messagesRouter from './routes/messages.js';
import invoicesRouter from './routes/invoices.js';
import stripeRouter from './routes/stripe.js';
import meetingsRouter from './routes/meetings.js';
import { requireAuth } from './middleware/auth.js';

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.options('*', cors());

app.use('/api/stripe', stripeRouter);

app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/client-intakes', clientIntakesRouter);
app.use('/api/meetings', meetingsRouter);

app.use('/api', requireAuth);

app.use('/api/users', usersRouter);
app.use('/api/workspaces', workspacesRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/files', filesRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/invoices', invoicesRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API server listening on ${port}`);
});
