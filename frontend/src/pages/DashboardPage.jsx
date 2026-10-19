import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ListTodo,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { calculateTaskKpis, taskApi } from '../api.js';
import { EmptyState, ErrorState, formatDate, isOverdue, LoadingState, PageHeading, StatusBadge } from '../components/ui.jsx';

const statusColors = {
  pending: '#9aa4b2',
  'in-progress': '#5684f5',
  completed: '#37b886',
};

const kpiCards = [
  { key: 'totalTasks', label: 'Total tasks', icon: ListTodo, tone: 'blue', note: 'Across your workspace' },
  { key: 'pendingTasks', label: 'Pending', icon: CircleDashed, tone: 'amber', note: 'Ready when you are' },
  { key: 'inProgressTasks', label: 'In progress', icon: Clock3, tone: 'violet', note: 'Currently underway' },
  { key: 'completedTasks', label: 'Completed', icon: CheckCircle2, tone: 'green', note: 'Nicely done' },
];

function KpiSkeleton() {
  return <div className="kpi-card skeleton-card"><div className="skeleton skeleton-icon" /><div className="skeleton skeleton-copy" /><div className="skeleton skeleton-number" /></div>;
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const tasks = await taskApi.list();
      const kpis = calculateTaskKpis(tasks);
      setData({ kpis, tasks });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const chartData = data
    ? [
        { name: 'Pending', value: data.kpis.pendingTasks, color: statusColors.pending },
        { name: 'In progress', value: data.kpis.inProgressTasks, color: statusColors['in-progress'] },
        { name: 'Completed', value: data.kpis.completedTasks, color: statusColors.completed },
      ].filter((slice) => slice.value > 0)
    : [];
  const recentTasks = data?.tasks.slice(0, 5) || [];
  const chartTotal = chartData.reduce((total, segment) => total + segment.value, 0);
  let chartPosition = 0;
  const chartGradient = chartData.map(({ value, color }) => {
    const start = chartPosition;
    chartPosition += (value / chartTotal) * 100;
    return `${color} ${start}% ${chartPosition}%`;
  }).join(', ');

  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title="Good work starts with a clear view."
        description="A live snapshot of the work you’ve planned and the progress you’ve made."
        action={<button className="button button-secondary" onClick={loadDashboard} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh</button>}
      />

      {error && <ErrorState message={error} onRetry={loadDashboard} />}

      <section className="kpi-grid" aria-label="Task metrics" aria-busy={loading}>
        {loading && !data
          ? kpiCards.map(({ key }) => <KpiSkeleton key={key} />)
          : kpiCards.map(({ key, label, icon: Icon, tone, note }) => (
              <article className="kpi-card" key={key}>
                <div className="kpi-topline">
                  <span className={`kpi-icon kpi-${tone}`}><Icon size={18} strokeWidth={1.9} aria-hidden="true" /></span>
                  <span className="kpi-caption">{note}</span>
                </div>
                <div className="kpi-value">{data?.kpis[key] ?? '—'}</div>
                <div className="kpi-label">{label}</div>
              </article>
            ))}
      </section>

      <section className="dashboard-grid">
        <article className="surface-card chart-card">
          <div className="section-header">
            <div><h2>Task overview</h2><p>How your work is distributed</p></div>
            <span className="subtle-badge"><span className="live-dot" /> Live</span>
          </div>
          {loading && !data ? <LoadingState label="Loading task overview" /> : data?.kpis.totalTasks === 0 ? (
            <EmptyState icon={ListTodo} title="Your canvas is clear" description="Create a task to see your progress here." action={<Link className="text-link" to="/tasks/new">Create your first task <ArrowRight size={15} /></Link>} />
          ) : (
            <div className="chart-layout">
              <div className="donut-wrap" role="img" aria-label="Task status distribution">
                <div className="donut-graphic" style={{ background: chartGradient ? `conic-gradient(${chartGradient})` : statusColors.pending }} />
                <div className="donut-center"><strong>{data?.kpis.totalTasks ?? 0}</strong><span>total tasks</span></div>
              </div>
              <div className="chart-legend">
                {[
                  ['Pending', 'pendingTasks', statusColors.pending, CircleDashed],
                  ['In progress', 'inProgressTasks', statusColors['in-progress'], Clock3],
                  ['Completed', 'completedTasks', statusColors.completed, Check],
                ].map(([label, key, color, Icon]) => (
                  <div className="legend-row" key={key}>
                    <span className="legend-mark" style={{ backgroundColor: color }}><Icon size={12} color="#fff" strokeWidth={2.5} /></span>
                    <span className="legend-label">{label}</span>
                    <strong>{data?.kpis[key] ?? 0}</strong>
                  </div>
                ))}
                <div className="legend-overdue"><span>Overdue</span><strong>{data?.kpis.overdueTasks ?? 0}</strong></div>
              </div>
            </div>
          )}
        </article>

        <article className="focus-card">
          <div className="focus-decoration focus-decoration-one" /><div className="focus-decoration focus-decoration-two" />
          <span className="focus-icon"><Sparkles size={19} aria-hidden="true" /></span>
          <p className="eyebrow">A LITTLE MOMENTUM</p>
          <h2>Make the next step the easy step.</h2>
          <p className="focus-description">Break a big, fuzzy idea into a practical plan you can start today.</p>
          <Link className="button button-light" to="/planner">Plan with AI <ArrowUpRight size={16} /></Link>
          {!loading && data?.kpis.overdueTasks > 0 && (
            <div className="focus-overdue"><span className="focus-alert-dot" /> You have {data.kpis.overdueTasks} overdue {data.kpis.overdueTasks === 1 ? 'task' : 'tasks'} to review.</div>
          )}
        </article>
      </section>

      <section className="surface-card recent-card">
        <div className="section-header recent-header">
          <div><h2>Recent tasks</h2><p>Your latest updates, all in one place</p></div>
          <Link className="text-link" to="/tasks">View all <ArrowRight size={15} /></Link>
        </div>
        {loading && !data ? (
          <div className="recent-loading"><LoadingState label="Loading recent tasks" /></div>
        ) : recentTasks.length === 0 ? (
          <EmptyState icon={ListTodo} title="No tasks yet" description="Create a task and it’ll show up here." action={<Link className="button button-primary button-small" to="/tasks/new"><Plus size={15} /> Create task</Link>} />
        ) : (
          <div className="table-scroll">
            <table className="task-table">
              <thead><tr><th>Task</th><th>Status</th><th>Due date</th><th className="align-right">Updated</th></tr></thead>
              <tbody>
                {recentTasks.map((task) => (
                  <tr key={task._id}>
                    <td><Link className="task-name" to={`/tasks/${task._id}`}>{task.title}</Link><span className="task-description-cell">{task.description || 'No description'}</span></td>
                    <td><StatusBadge status={task.status} /></td>
                    <td><span className={isOverdue(task) ? 'due-date overdue-text' : 'due-date'}>{isOverdue(task) && <ArrowDownRight size={14} />}{formatDate(task.dueDate, { month: 'short', day: 'numeric' })}</span></td>
                    <td className="align-right updated-date">{formatDate(task.updatedAt, { month: 'short', day: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="dashboard-footnote"><span className="live-dot" /> Dashboard metrics reflect tasks saved in your database.</p>
    </>
  );
}
