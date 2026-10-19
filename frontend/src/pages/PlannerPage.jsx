import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Clipboard,
  Clock3,
  LoaderCircle,
  MessageCircle,
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

const answerExamples = [
  "Give me 15 unique boys' names with a mix of traditional and modern styles.",
  'Explain the difference between Express middleware and controllers.',
  'Write a professional description for my portfolio project.',
];

export default function PlannerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const taskFromDetails = location.state?.task;
  const [mode, setMode] = useState('plan');
  const [title, setTitle] = useState(taskFromDetails?.title || '');
  const [description, setDescription] = useState(taskFromDetails?.description || '');
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [promptError, setPromptError] = useState('');

  useEffect(() => {
    if (!taskFromDetails) return;
    setTitle(taskFromDetails.title || '');
    setDescription(taskFromDetails.description || '');
    setPlan(null);
    setError('');
  }, [taskFromDetails]);

  const selectMode = (nextMode) => {
    if (loading || nextMode === mode) return;
    setMode(nextMode);
    setError('');
    setTitleError('');
    setPromptError('');
  };

  const generatePlan = async (event) => {
    event?.preventDefault();
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (!cleanTitle) {
      setTitleError('Add a short title so the planner knows what you’re working on.');
      return;
    }
    if (cleanTitle.length > 150) {
      setTitleError('Task titles can’t exceed 150 characters.');
      return;
    }
    if (cleanTitle.length + cleanDescription.length > 3000) {
      setError('Keep your combined title and context under 3,000 characters.');
      return;
    }

    setTitleError('');
    setError('');
    setPlan(null);
    setLoading(true);
    try {
      setPlan(await taskApi.planTask({ title: cleanTitle, description: cleanDescription }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const askAi = async (event) => {
    event?.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setPromptError('Enter a question or describe what you’d like AI to write.');
      return;
    }
    if (cleanPrompt.length > 3000) {
      setPromptError('Keep your prompt under 3,000 characters.');
      return;
    }

    setPromptError('');
    setError('');
    setAnswer('');
    setCopied(false);
    setLoading(true);
    try {
      setAnswer(await taskApi.answerPrompt(cleanPrompt));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('Could not copy the answer. Check your browser clipboard permissions.');
    }
  };

  return (
    <>
      <PageHeading
        eyebrow="TASKFLOW AI"
        title="A thoughtful assistant for your work."
        description="Turn a task into a practical plan, or ask a question and get a direct answer."
      />

      <div className="ai-mode-switch" role="tablist" aria-label="Choose an AI mode">
        <button
          id="plan-tab"
          className={`ai-mode-tab${mode === 'plan' ? ' ai-mode-tab-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={mode === 'plan'}
          aria-controls="ai-workspace"
          onClick={() => selectMode('plan')}
        >
          <WandSparkles size={17} aria-hidden="true" />
          <span><strong>Plan my task</strong><small>Break work into clear steps</small></span>
        </button>
        <button
          id="answer-tab"
          className={`ai-mode-tab${mode === 'answer' ? ' ai-mode-tab-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={mode === 'answer'}
          aria-controls="ai-workspace"
          onClick={() => selectMode('answer')}
        >
          <MessageCircle size={17} aria-hidden="true" />
          <span><strong>Ask AI</strong><small>Get an answer or create text</small></span>
        </button>
      </div>

      <div className="planner-layout ai-workspace" id="ai-workspace" role="tabpanel" aria-labelledby={`${mode}-tab`}>
        {mode === 'plan' ? (
          <section className="surface-card planner-form-card">
            <div className="planner-card-heading">
              <span className="planner-spark-icon"><WandSparkles size={20} /></span>
              <div><h2>What are you working on?</h2><p>Share the outcome you want and any helpful context.</p></div>
            </div>
            <form onSubmit={generatePlan} noValidate>
              <div className="field-group">
                <label htmlFor="planner-title">Task title <span className="required-mark">*</span></label>
                <input
                  id="planner-title"
                  type="text"
                  value={title}
                  maxLength={150}
                  onChange={(event) => { setTitle(event.target.value); setTitleError(''); }}
                  placeholder="e.g. Complete my Node.js assignment"
                  aria-invalid={Boolean(titleError)}
                  aria-describedby={titleError ? 'planner-title-error' : undefined}
                  required
                />
                {titleError && <span className="field-error" id="planner-title-error">{titleError}</span>}
              </div>
              <div className="field-group">
                <label htmlFor="planner-description">Context <span className="optional-label">Optional</span></label>
                <textarea
                  id="planner-description"
                  rows={6}
                  maxLength={2000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What does success look like? Add details, constraints, or a deadline."
                  aria-describedby="planner-description-count"
                />
                <span className="field-help character-count" id="planner-description-count">
                  {description.length} / 2,000 characters
                </span>
              </div>
              {error && <div className="ai-inline-error" role="alert">{error}</div>}
              <button className="button button-primary planner-submit" type="submit" disabled={loading}>
                {loading ? <LoaderCircle size={17} className="spin" /> : <Send size={16} />}
                {loading ? 'Building your plan…' : 'Generate plan'}
                {!loading && <ArrowRight size={15} />}
              </button>
              <p className="planner-privacy"><span className="secure-dot" /> Your plan is generated by the configured AI provider.</p>
            </form>
          </section>
        ) : (
          <section className="surface-card planner-form-card answer-form-card">
            <div className="planner-card-heading">
              <span className="planner-spark-icon answer-icon"><MessageCircle size={20} /></span>
              <div><h2>What would you like to know?</h2><p>Ask a question or request a useful draft. AI answers directly.</p></div>
            </div>
            <form onSubmit={askAi} noValidate>
              <div className="field-group">
                <label htmlFor="answer-prompt">Your question or prompt <span className="required-mark">*</span></label>
                <textarea
                  id="answer-prompt"
                  rows={7}
                  maxLength={3000}
                  value={prompt}
                  onChange={(event) => { setPrompt(event.target.value); setPromptError(''); }}
                  placeholder="Ask a question, request an explanation, or describe the text you need…"
                  aria-invalid={Boolean(promptError)}
                  aria-describedby={promptError ? 'answer-prompt-error' : 'answer-prompt-count'}
                  required
                />
                {promptError
                  ? <span className="field-error" id="answer-prompt-error">{promptError}</span>
                  : <span className="field-help character-count" id="answer-prompt-count">{prompt.length} / 3,000 characters</span>}
              </div>
              <div className="prompt-examples" aria-label="Example prompts">
                <span>Try an example</span>
                {answerExamples.map((example) => (
                  <button className="prompt-chip" key={example} type="button" onClick={() => { setPrompt(example); setPromptError(''); }}>
                    {example}
                  </button>
                ))}
              </div>
              {error && <div className="ai-inline-error" role="alert">{error}</div>}
              <button className="button button-primary planner-submit" type="submit" disabled={loading}>
                {loading ? <LoaderCircle size={17} className="spin" /> : <Send size={16} />}
                {loading ? 'Getting your answer…' : 'Ask AI'}
                {!loading && <ArrowRight size={15} />}
              </button>
              <p className="planner-privacy"><span className="secure-dot" /> Answers are not saved as tasks.</p>
            </form>
          </section>
        )}

        <section className={`planner-result${plan || answer ? ' planner-result-ready' : ''}`} aria-live="polite" aria-busy={loading}>
          {!loading && !error && mode === 'plan' && !plan && (
            <div className="planner-placeholder">
              <div className="placeholder-orbit"><span className="orbit-dot orbit-dot-one" /><span className="orbit-dot orbit-dot-two" /><span className="placeholder-spark"><Sparkles size={25} /></span></div>
              <h2>A little clarity goes a long way.</h2>
              <p>Your plan will appear here with a summary, priority, effort estimate, and practical next steps.</p>
              <div className="placeholder-features"><span><Check size={14} /> Task-specific steps</span><span><Check size={14} /> Clear priority</span></div>
            </div>
          )}

          {!loading && !error && mode === 'answer' && !answer && (
            <div className="planner-placeholder answer-placeholder">
              <div className="placeholder-orbit"><span className="placeholder-spark"><MessageCircle size={23} /></span></div>
              <h2>Good questions move work forward.</h2>
              <p>Your answer will appear here. Ask for an explanation, ideas, or a polished piece of writing.</p>
              <div className="placeholder-features"><span><Check size={14} /> Direct answers</span><span><Check size={14} /> Useful drafts</span></div>
            </div>
          )}

          {loading && (
            <div className="planner-thinking" role="status">
              <span className="thinking-icon"><Sparkles size={20} /></span>
              <h2>{mode === 'plan' ? 'Putting the pieces together…' : 'Thinking through your question…'}</h2>
              <p>{mode === 'plan' ? 'Your task details are being shaped into practical next steps.' : 'A clear, direct answer is on its way.'}</p>
              <div className="thinking-line"><span /></div>
            </div>
          )}

          {error && !loading && (
            <div className="planner-error-result" role="alert">
              <span className="result-error-icon">!</span>
              <h2>{mode === 'plan' ? 'We couldn’t make a plan this time.' : 'We couldn’t get an answer this time.'}</h2>
              <p>{error}</p>
              <button className="button button-secondary button-small" type="button" onClick={mode === 'plan' ? generatePlan : askAi}>
                <RotateCcw size={14} /> Try again
              </button>
            </div>
          )}

          {mode === 'plan' && plan && !loading && (
            <article className="plan-card">
              <div className="plan-card-top">
                <span className="plan-ready-label"><span className="plan-ready-dot" /> YOUR PLAN</span>
                <span className={`priority-pill priority-${plan.priority}`}>{plan.priority} priority</span>
              </div>
              <h2>{plan.summary}</h2>
              <div className="plan-insights">
                <div className="plan-insight"><span className="insight-icon"><Clock3 size={15} /></span><div><span>Estimated time</span><strong>{plan.estimatedHours} {plan.estimatedHours === 1 ? 'hour' : 'hours'}</strong></div></div>
                <div className="plan-insight"><span className="insight-icon insight-spark"><Sparkles size={15} /></span><div><span>Priority</span><strong>{priorityLabels[plan.priority]}</strong></div></div>
              </div>
              <div className="plan-steps-heading">
                <div><h3>Your next steps</h3><p>A good place to start, one step at a time.</p></div>
                <span className="step-count">{plan.steps.length} steps</span>
              </div>
              <ol className="plan-steps">
                {plan.steps.map((step, index) => <li key={`${index}-${step}`}><span className="step-number">{String(index + 1).padStart(2, '0')}</span><span>{step}</span></li>)}
              </ol>
              <div className="plan-footer">
                <button className="button button-secondary button-small" type="button" onClick={generatePlan} disabled={loading}><RotateCcw size={14} /> Regenerate</button>
                <button
                  className="button button-primary button-small"
                  type="button"
                  onClick={() => navigate('/tasks/new', { state: { task: { title: title.trim(), description: description.trim() } } })}
                >
                  <Check size={14} /> Create a task
                </button>
              </div>
            </article>
          )}

          {mode === 'answer' && answer && !loading && (
            <article className="answer-card">
              <div className="answer-card-heading">
                <span className="plan-ready-label"><span className="plan-ready-dot" /> AI ANSWER</span>
                <button className="button button-secondary button-small" type="button" onClick={copyAnswer}>
                  {copied ? <Check size={14} /> : <Clipboard size={14} />}
                  {copied ? 'Copied' : 'Copy answer'}
                </button>
              </div>
              <div className="answer-content">{answer}</div>
              <div className="answer-footer">
                <span>Generated from your prompt</span>
                <button className="text-link answer-again" type="button" onClick={() => { setAnswer(''); setError(''); document.getElementById('answer-prompt')?.focus(); }}>
                  Ask another question <ArrowRight size={14} />
                </button>
              </div>
            </article>
          )}
        </section>
      </div>
      <div className="planner-footer-note">AI-generated content is a starting point. Review it and make it your own.</div>
    </>
  );
}
