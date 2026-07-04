import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();


  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          🎟️ TicketCollector
        </Link>

        <div className="navbar-links" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Link to="/events" className={`nav-link ${isActive('/events') ? 'active' : ''}`}>
            Events
          </Link>

          {user && (
            <Link to="/bookings" className={`nav-link ${isActive('/bookings') ? 'active' : ''}`}>
              My Tickets
            </Link>
          )}

          {(user?.role === 'organiser' || user?.role === 'admin') && (
            <Link to="/organiser" className={`nav-link ${isActive('/organiser') ? 'active' : ''}`}>
              <LayoutDashboard size={15} />
              <span>Organiser</span>
            </Link>
          )}

          {user?.role === 'admin' && (
            <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>
              Admin
            </Link>
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
              <div style={{ textAlign: 'right', display: 'none' }} className="user-info">
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{user.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{user.role}</div>
              </div>
              <div
                className="nav-avatar"
                title={user.name}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleLogout}
                style={{ padding: '6px 10px' }}
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', marginLeft: '8px' }}>
              <Link to="/login" className="btn btn-secondary btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
