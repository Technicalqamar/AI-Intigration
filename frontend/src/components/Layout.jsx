import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlignLeft,
  ArrowUpRight,
  Bot,
  MessagesSquare,
  CheckSquare2,
  LayoutDashboard,
  Moon,
  Plus,
  Sun,
} from 'lucide-react';
import { Toast } from './ui.jsx';

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'All tasks', icon: CheckSquare2 },
  { to: '/chat', label: 'AI chat', icon: MessagesSquare },
  { to: '/planner', label: 'AI planner', icon: Bot },
];

const pageTitles = [
  { match: '/planner', label: 'AI task planner' },
  { match: '/chat', label: 'AI chat' },
  { match: '/tasks/new', label: 'Create a task' },
  { match: '/tasks', label: 'Tasks' },
  { match: '/', label: 'Overview' },
];

export default function Layout() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('taskflow-theme') || 'light';
    } catch {
      return 'light';
    }
  });
  const [toast, setToast] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = pageTitles.find(({ match }) =>
    match === '/' ? location.pathname === '/' : location.pathname.startsWith(match)
  )?.label || 'Task details';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('taskflow-theme', theme);
    } catch {
      // Theme preference remains active for the current page.
    }
  }, [theme]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message, type = 'success') => setToast({ message, type, id: Date.now() });

  return (
    <div className="app-shell min-h-screen">
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="Taskflow home">
          <span className="brand-mark"><AlignLeft size={21} strokeWidth={2.4} /></span>
          <span className="brand-name">taskflow<span>.</span></span>
        </Link>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              aria-label={label}
              className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
            >
              <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
              <span>{label}</span>
              {label === 'AI planner' && <span className="nav-new">AI</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <div className="note-icon"><Bot size={17} aria-hidden="true" /></div>
          <strong>Make space for deep work</strong>
          <p>Turn your next big idea into a clear, actionable plan.</p>
          <Link to="/chat">Chat with Taskflow AI <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>
        <div className="sidebar-footer">
          <div className="avatar">TF</div>
          <div className="user-meta"><strong>Your workspace</strong><span>Personal plan</span></div>
          <span className="online-dot" title="Workspace active" />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><AlignLeft size={19} /></span> taskflow<span>.</span></div>
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-divider">/</span><strong>{pageTitle}</strong></div>
          <div className="topbar-actions">
            <button
              className="icon-button theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="button button-primary topbar-create" type="button" onClick={() => navigate('/tasks/new')}>
              <Plus size={17} aria-hidden="true" /><span>New task</span>
            </button>
          </div>
        </header>
        <div className="page-content">
          <Outlet context={{ notify, theme }} />
        </div>
      </main>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
