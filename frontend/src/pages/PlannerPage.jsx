import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Clock3,
  LoaderCircle,
  RotateCcw,
  Send,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { PageHeading } from '../components/ui.jsx';
import { taskApi } from '../api.js';

const priorityLabels = {
  low: 'A steady pace',
  medium: 'Make room for it',
  high: 'Give this your focus',
};

export default function PlannerPage() {
  const location = useLocation();
  const taskFromDetails = location.state?.task;
  const [title, setTitle] = useState(taskFromDetails?.title || '');
  const [description, setDescription] = useState(taskFromDetails?.description || '');
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [titleError, setTitleError] = useState('');

  useEffect(() => {
    if (!taskFromDetails) return;
    setTitle(taskFromDetails.title || '');
    setDescription(taskFromDetails.description || '');
    setPlan(null);
    setError('');
  }, [taskFromDetails]);

  const generate = async (event) => {
    event?.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setTitleError('Add a short title so the planner knows what you’re working on.');
      return;
    }
    if (cleanTitle.length > 200 || description.length > 2000) {
      setError('Keep the title under 200 characters and the description under 2,000 characters.');
      return;
    }

    setTitleError('');
    setError('');
    setPlan(null);
    setLoading(true);
    try {
      setPlan(await taskApi.planTask({ title: cleanTitle, description: description.trim() }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="AI TASK PLANNER"
        title="From big idea to first step."
        description="Share what you’re working on. Get a thoughtful, practical plan back from your AI assistant."
      />

      <div className="planner-layout">
        <section className="surface-card planner-form-card">
          <div className="planner-card-heading"><span className="planner-spark-icon"><WandSparkles size={20} /></span><div><h2>What’s on your mind?</h2><p>Be as detailed or as brief as you like.</p></div></div>
          <form onSubmit={generate} noValidate>
            <div className="field-group">
              <label htmlFor="planner-title">Task title <span className="required-mark">*</span></label>
              <input id="planner-title" type="text" value={title} maxLength={200} onChange={(event) => { setTitle(event.target.value); setTitleError(''); }} placeholder="e.g. Launch a customer newsletter" aria-invalid={Boolean(titleError)} aria-describedby={titleError ? 'planner-title-error' : undefined} />
              {titleError && <span className="field-error" id="planner-title-error">{titleError}</span>}
            </div>
            <div className="field-group">
              <label htmlFor="planner-description">A little more context <span className="optional-label">Optional</span></label>
              <textarea id="planner-description" rows={8} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What does success look like? Are there any constraints, milestones, or details that might help?" />
              <span className="field-help character-count">{description.length} / 2,000 characters</span>
            </div>
            <button className="button button-primary planner-submit" type="submit" disabled={loading}>
              {loading ? <LoaderCircle size={17} className="spin" /> : <Send size={16} />}
              {loading ? 'Thinking through your task…' : 'Generate plan'}
              {!loading && <ArrowRight size={15} />}
            </button>
            <p className="planner-privacy"><span className="secure-dot" /> Your request is sent securely to the configured AI provider.</p>
          </form>
        </section>

        <section className={`planner-result${plan ? ' planner-result-ready' : ''}`} aria-live="polite">
          {!plan && !loading && !error && (
            <div className="planner-placeholder">
              <div className="placeholder-orbit"><span className="orbit-dot orbit-dot-one" /><span className="orbit-dot orbit-dot-two" /><span className="placeholder-spark"><Sparkles size={25} /></span></div>
              <h2>A little clarity goes a long way.</h2>
              <p>Your plan will appear here with a summary, a sense of priority, and practical next steps.</p>
              <div className="placeholder-features"><span><Check size={14} /> One clear summary</span><span><Check size={14} /> Actionable steps</span></div>
            </div>
          )}

          {loading && (
            <div className="planner-thinking"><span className="thinking-icon"><Sparkles size={20} /></span><h2>Putting the pieces together…</h2><p>Your task is being sent to the AI planner. This can take a moment.</p><div className="thinking-line"><span /></div></div>
          )}

          {error && !loading && (
            <div className="planner-error-result" role="alert"><span className="result-error-icon">!</span><h2>We couldn’t make a plan this time.</h2><p>{error}</p><button className="button button-secondary button-small" onClick={() => setError('')}><RotateCcw size={14} /> Try again</button></div>
          )}

          {plan && !loading && (
            <article className="plan-card">
              <div className="plan-card-top"><span className="plan-ready-label"><span className="plan-ready-dot" /> YOUR PLAN</span><span className={`priority-pill priority-${plan.priority}`}>{plan.priority} priority</span></div>
              <h2>{plan.summary}</h2>
              <div className="plan-insights"><div className="plan-insight"><span className="insight-icon"><Clock3 size={15} /></span><div><span>Estimated time</span><strong>{plan.estimatedHours} {plan.estimatedHours === 1 ? 'hour' : 'hours'}</strong></div></div><div className="plan-insight"><span className="insight-icon insight-spark"><Sparkles size={15} /></span><div><span>Priority</span><strong>{priorityLabels[plan.priority]}</strong></div></div></div>
              <div className="plan-steps-heading"><div><h3>Your next steps</h3><p>A good place to start, one step at a time.</p></div><span className="step-count">{plan.steps.length} steps</span></div>
              <ol className="plan-steps">
                {plan.steps.map((step, index) => <li key={`${index}-${step}`}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><span>{step}</span></li>)}
              </ol>
              <div className="plan-footer"><button className="button button-secondary button-small" onClick={generate} disabled={loading}><RotateCcw size={14} /> Regenerate</button><Link className="text-link" to="/tasks/new">Create a task <ArrowRight size={14} /></Link></div>
            </article>
          )}
        </section>
      </div>
      <div className="planner-footer-note">AI-generated plans are suggestions. Make them your own.</div>
    </>
  );
}
