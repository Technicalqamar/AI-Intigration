import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Layout from './components/Layout.jsx';
import { PageHeading } from './components/ui.jsx';

const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const ChatPage = lazy(() => import('./pages/ChatPage.jsx'));
const PlannerPage = lazy(() => import('./pages/PlannerPage.jsx'));
const TaskDetailsPage = lazy(() => import('./pages/TaskDetailsPage.jsx'));
const TaskFormPage = lazy(() => import('./pages/TaskFormPage.jsx'));
const TasksPage = lazy(() => import('./pages/TasksPage.jsx'));

function NotFoundPage() {
  return (
    <>
      <PageHeading eyebrow="NOT FOUND" title="This page wandered off." description="The address might have changed, or the page may no longer exist." />
      <Link className="back-link" to="/"><ArrowLeft size={15} /> Back to your overview</Link>
    </>
  );
}

export default function App() {
  return (
    <Suspense fallback={<div className="page-loading" role="status">Opening your workspace…</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tasks/new" element={<TaskFormPage />} />
          <Route path="tasks/:id/edit" element={<TaskFormPage />} />
          <Route path="tasks/:id" element={<TaskDetailsPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
