import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Pencil,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { taskApi } from '../api.js';
import { EmptyState, ErrorState, formatDate, isOverdue, LoadingState, PageHeading, StatusBadge } from '../components/ui.jsx';

export default function TaskDetailsPage() {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { notify } = useOutletContext();

  const loadTask = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setTask(await taskApi.get(id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadTask(); }, [loadTask]);

  const removeTask = async () => {
    setDeleting(true);
    try {
      await taskApi.remove(id);
      notify('Task deleted successfully.');
      navigate('/tasks', { replace: true });
    } catch (err) {
      notify(err.message, 'error');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="detail-loading"><LoadingState label="Loading task details" /></div>;
  if (error || !task) {
    return (
      <>
        <PageHeading eyebrow="TASK DETAILS" title="Task not available" />
        <ErrorState message={error || 'This task may have been deleted.'} onRetry={loadTask} />
        <Link className="back-link detail-back-link" to="/tasks"><ArrowLeft size={15} /> Back to all tasks</Link>
      </>
    );
  }

  const overdue = isOverdue(task);

  return (
    <>
      <PageHeading
        eyebrow="TASK DETAILS"
        title={task.title}
        description="The full picture, and a clear path to your next step."
        action={<div className="detail-heading-actions"><Link className="button button-secondary" to="/tasks"><ArrowLeft size={15} /> All tasks</Link><Link className="button button-primary" to={`/tasks/${id}/edit`}><Pencil size={15} /> Edit task</Link></div>}
      />

      <div className="detail-layout">
        <section className="surface-card detail-main">
          <div className="detail-status-line"><StatusBadge status={task.status} />{overdue && <span className="overdue-pill"><span className="overdue-dot" /> Overdue</span>}</div>
          <div className="detail-description-block">
            <h2>About this task</h2>
            <p className={task.description ? '' : 'muted-copy'}>{task.description || 'There’s no description yet. Add a few details to make your next step easier.'}</p>
          </div>
          <div className="detail-meta-grid">
            <div className="detail-meta-item"><span className="meta-icon"><CalendarDays size={17} /></span><div><span>Due date</span><strong className={overdue ? 'overdue-text' : ''}>{formatDate(task.dueDate)}</strong></div></div>
            <div className="detail-meta-item"><span className="meta-icon"><Clock3 size={17} /></span><div><span>Last updated</span><strong>{formatDate(task.updatedAt)}</strong></div></div>
            <div className="detail-meta-item"><span className="meta-icon"><Check size={17} /></span><div><span>Created</span><strong>{formatDate(task.createdAt)}</strong></div></div>
          </div>
          <div className="detail-danger-zone">
            <div><strong>Remove this task</strong><span>This action can’t be undone.</span></div>
            <button className="button button-danger-outline" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Delete</button>
          </div>
        </section>

        <aside className="detail-aside">
          <div className="detail-ai-card">
            <span className="detail-ai-icon"><Sparkles size={18} /></span>
            <p className="eyebrow">NEED A STARTING POINT?</p>
            <h2>Get a plan for this task.</h2>
            <p>Turn the details you’ve already written into focused, actionable steps.</p>
            <Link className="button button-primary" to="/planner" state={{ task: { title: task.title, description: task.description || '' } }}>Plan with AI <ArrowUpRight size={15} /></Link>
          </div>
          <div className="detail-id-card"><span>Task ID</span><code>{task._id}</code></div>
        </aside>
      </div>

      {confirmDelete && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setConfirmDelete(false); }}>
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-detail-title">
            <div className="confirm-icon"><Trash2 size={20} /></div><h2 id="delete-detail-title">Delete this task?</h2>
            <p><strong>{task.title}</strong> will be permanently removed from your workspace.</p>
            <div className="dialog-actions"><button className="button button-secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</button><button className="button button-danger" onClick={removeTask} disabled={deleting}>{deleting ? 'Deleting…' : <><Check size={15} /> Delete task</>}</button></div>
          </section>
        </div>
      )}
    </>
  );
}
