import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { taskApi } from '../api.js';
import { EmptyState, ErrorState, formatDate, isOverdue, LoadingState, PageHeading, StatusBadge } from '../components/ui.jsx';

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { notify } = useOutletContext();

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setTasks(await taskApi.list());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return tasks.filter((task) => {
      const matchesStatus = status === 'all' || task.status === status;
      const matchesSearch = !query || `${task.title} ${task.description || ''}`.toLocaleLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [search, status, tasks]);

  const deleteTask = async () => {
    if (!taskToDelete) return;
    setDeleting(true);
    try {
      await taskApi.remove(taskToDelete._id);
      setTasks((current) => current.filter((task) => task._id !== taskToDelete._id));
      notify('Task deleted successfully.');
      setTaskToDelete(null);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="YOUR WORK"
        title="All tasks"
        description="A considered list of everything you’re working on."
        action={<Link className="button button-primary" to="/tasks/new"><Plus size={16} /> New task</Link>}
      />

      <section className="surface-card tasks-card">
        <div className="tasks-toolbar">
          <div className="task-result-count">
            <span className="toolbar-icon"><ClipboardList size={17} /></span>
            <span>{loading ? 'Loading tasks' : `${filteredTasks.length} ${filteredTasks.length === 1 ? 'task' : 'tasks'}`}</span>
          </div>
          <div className="task-filters">
            <label className="search-field">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search tasks</span>
              <input
                type="search"
                placeholder="Search tasks…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setSearch('')}>×</button>}
            </label>
            <label className="select-field">
              <span className="sr-only">Filter by status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </label>
          </div>
        </div>

        {error ? <ErrorState message={error} onRetry={loadTasks} /> : loading ? (
          <div className="tasks-loading"><LoadingState label="Loading tasks from your workspace" /></div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="A fresh start"
            description="You haven’t created any tasks yet. Add one to get your work moving."
            action={<Link className="button button-primary button-small" to="/tasks/new"><Plus size={15} /> Create your first task</Link>}
          />
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No tasks match those filters"
            description="Try a different search, or clear the status filter."
            action={<button className="button button-secondary button-small" onClick={() => { setSearch(''); setStatus('all'); }}>Clear filters</button>}
          />
        ) : (
          <div className="table-scroll">
            <table className="task-table all-tasks-table">
              <thead>
                <tr><th>Task</th><th>Status</th><th>Due date</th><th>Last updated</th><th className="align-right">Actions</th></tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr key={task._id}>
                    <td className="task-cell">
                      <Link className="task-name" to={`/tasks/${task._id}`}>{task.title}</Link>
                      <span className="task-description-cell">{task.description || 'No description'}</span>
                    </td>
                    <td><StatusBadge status={task.status} /></td>
                    <td>
                      <span className={isOverdue(task) ? 'due-date overdue-text' : 'due-date'}>
                        {isOverdue(task) ? <ArrowDownRight size={14} aria-label="Overdue" /> : <CalendarDays size={14} />}
                        {formatDate(task.dueDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="updated-date">{formatDate(task.updatedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="icon-button row-action" to={`/tasks/${task._id}`} aria-label={`View ${task.title}`} title="View task"><Eye size={16} /></Link>
                        <Link className="icon-button row-action" to={`/tasks/${task._id}/edit`} aria-label={`Edit ${task.title}`} title="Edit task"><Pencil size={15} /></Link>
                        <button className="icon-button row-action row-delete" onClick={() => setTaskToDelete(task)} aria-label={`Delete ${task.title}`} title="Delete task"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!error && !loading && filteredTasks.length > 0 && (
          <div className="task-mobile-list" aria-label="Tasks">
            {filteredTasks.map((task) => (
              <article className="task-mobile-card" key={`mobile-${task._id}`}>
                <div className="task-mobile-card-top">
                  <StatusBadge status={task.status} />
                  {task.dueDate && (
                    <span className={isOverdue(task) ? 'due-date overdue-text' : 'due-date'}>
                      {isOverdue(task) ? <ArrowDownRight size={14} aria-hidden="true" /> : <CalendarDays size={14} aria-hidden="true" />}
                      {formatDate(task.dueDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                      {isOverdue(task) && <span className="task-overdue-label">Overdue</span>}
                    </span>
                  )}
                </div>
                <Link className="task-mobile-title" to={`/tasks/${task._id}`}>{task.title}</Link>
                <p className="task-mobile-description">{task.description || 'No description added yet.'}</p>
                <div className="task-mobile-card-footer">
                  <span className="updated-date">Updated {formatDate(task.updatedAt, { month: 'short', day: 'numeric' })}</span>
                  <div className="row-actions" aria-label={`Actions for ${task.title}`}>
                    <Link className="icon-button row-action" to={`/tasks/${task._id}`} aria-label={`View ${task.title}`} title="View task"><Eye size={16} /></Link>
                    <Link className="icon-button row-action" to={`/tasks/${task._id}/edit`} aria-label={`Edit ${task.title}`} title="Edit task"><Pencil size={15} /></Link>
                    <button className="icon-button row-action row-delete" type="button" onClick={() => setTaskToDelete(task)} aria-label={`Delete ${task.title}`} title="Delete task"><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {!loading && !error && tasks.length > 0 && (
          <div className="tasks-card-footer"><span>Showing {filteredTasks.length} of {tasks.length} tasks</span><Link to="/" className="text-link">Back to overview <ArrowRight size={14} /></Link></div>
        )}
      </section>

      {taskToDelete && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setTaskToDelete(null); }}>
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
            <div className="confirm-icon"><Trash2 size={20} /></div>
            <h2 id="delete-title">Delete this task?</h2>
            <p id="delete-description"><strong>{taskToDelete.title}</strong> will be permanently removed from your workspace.</p>
            <div className="dialog-actions">
              <button className="button button-secondary" onClick={() => setTaskToDelete(null)} disabled={deleting}>Cancel</button>
              <button className="button button-danger" onClick={deleteTask} disabled={deleting}>{deleting ? 'Deleting…' : <><Check size={15} /> Delete task</>}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
