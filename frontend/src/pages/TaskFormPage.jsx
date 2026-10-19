import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ChevronDown, LoaderCircle, Save } from 'lucide-react';
import { taskApi } from '../api.js';
import { ErrorState, LoadingState, PageHeading } from '../components/ui.jsx';

const initialForm = { title: '', description: '', status: 'pending', dueDate: '' };

export default function TaskFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const navigate = useNavigate();
  const { notify } = useOutletContext();

  useEffect(() => {
    if (!editing) return;
    let active = true;
    taskApi.get(id)
      .then((task) => {
        if (!active) return;
        setForm({
          title: task.title || '',
          description: task.description || '',
          status: task.status || 'pending',
          dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
        });
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [editing, id]);

  const setField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: '' }));
  };

  const validateForm = () => {
    const errors = {};
    if (!form.title.trim()) errors.title = 'A task title is required.';
    else if (form.title.trim().length > 200) errors.title = 'Keep your title under 200 characters.';
    if (form.description.length > 2000) errors.description = 'Keep your description under 2,000 characters.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    setError('');
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      dueDate: form.dueDate || null,
    };

    try {
      const task = editing ? await taskApi.update(id, payload) : await taskApi.create(payload);
      notify(editing ? 'Your changes have been saved.' : 'Your new task is ready.');
      navigate(`/tasks/${task._id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="form-loading"><LoadingState label="Loading task" /></div>;
  if (editing && error && !form.title) {
    return <><PageHeading eyebrow="TASKS" title="Edit task" /><ErrorState message={error} onRetry={() => window.location.reload()} /><Link className="back-link" to="/tasks"><ArrowLeft size={15} /> Back to tasks</Link></>;
  }

  return (
    <>
      <PageHeading
        eyebrow={editing ? 'REFINE YOUR WORK' : 'MAKE A PLAN'}
        title={editing ? 'Edit task' : 'Create a task'}
        description={editing ? 'Make adjustments to keep your plan current.' : 'Capture the details and give your next step a place to begin.'}
        action={<Link className="back-link" to={editing ? `/tasks/${id}` : '/tasks'}><ArrowLeft size={15} /> Cancel</Link>}
      />

      <div className="form-layout">
        <form className="surface-card task-form" onSubmit={submit} noValidate>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="form-section-heading"><span className="form-section-number">01</span><div><h2>The essentials</h2><p>Give this task a name and a little context.</p></div></div>

          <div className="field-group">
            <label htmlFor="task-title">Task title <span className="required-mark">*</span></label>
            <input
              id="task-title"
              name="title"
              type="text"
              value={form.title}
              onChange={setField}
              placeholder="e.g. Prepare the product launch"
              maxLength={200}
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={fieldErrors.title ? 'title-error' : 'title-help'}
              autoFocus
            />
            {fieldErrors.title ? <span className="field-error" id="title-error">{fieldErrors.title}</span> : <span className="field-help" id="title-help">A clear title makes it easier to pick up where you left off.</span>}
          </div>

          <div className="field-group">
            <label htmlFor="task-description">Description <span className="optional-label">Optional</span></label>
            <textarea
              id="task-description"
              name="description"
              value={form.description}
              onChange={setField}
              rows={5}
              maxLength={2000}
              placeholder="Add details, context, or the outcome you’re aiming for…"
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldErrors.description ? 'description-error' : 'description-help'}
            />
            <span className={fieldErrors.description ? 'field-error' : 'field-help'} id={fieldErrors.description ? 'description-error' : 'description-help'}>
              {fieldErrors.description || `${form.description.length} / 2,000 characters`}
            </span>
          </div>

          <div className="form-divider" />
          <div className="form-section-heading"><span className="form-section-number">02</span><div><h2>Timing & progress</h2><p>Keep your deadline and current status close at hand.</p></div></div>

          <div className="form-two-columns">
            <div className="field-group">
              <label htmlFor="task-status">Status</label>
              <div className="select-control"><select id="task-status" name="status" value={form.status} onChange={setField}><option value="pending">Pending</option><option value="in-progress">In progress</option><option value="completed">Completed</option></select><ChevronDown size={16} aria-hidden="true" /></div>
            </div>
            <div className="field-group">
              <label htmlFor="task-due-date">Due date <span className="optional-label">Optional</span></label>
              <div className="date-control"><CalendarDays size={16} aria-hidden="true" /><input id="task-due-date" name="dueDate" type="date" value={form.dueDate} onChange={setField} /></div>
            </div>
          </div>

          <div className="form-footer">
            <span className="required-note"><span className="required-mark">*</span> Required field</span>
            <button className="button button-primary" type="submit" disabled={saving}>
              {saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </form>

        <aside className="form-aside">
          <div className="aside-tip-card">
            <div className="tip-icon"><CalendarDays size={18} /></div>
            <h3>A small tip</h3>
            <p>Write down the outcome you want, not just the activity. It makes the next action easier to see.</p>
          </div>
          <div className="aside-checklist">
            <span className="aside-check-icon">✓</span>
            <div><strong>Saved to your workspace</strong><span>Changes are only applied after the server confirms them.</span></div>
          </div>
        </aside>
      </div>
    </>
  );
}
