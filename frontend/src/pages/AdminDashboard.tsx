import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, Calendar, Ticket, DollarSign, PlusCircle, Shield } from 'lucide-react';
import { adminAPI } from '../api';

export default function AdminDashboard() {
  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: () => adminAPI.stats().then(r => r.data) });
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: () => adminAPI.users().then(r => r.data) });
  const { data: events = [] } = useQuery({ queryKey: ['admin-events'], queryFn: () => adminAPI.events().then(r => r.data) });

  const statCards = [
    { label: 'Total Users', value: stats?.total_users || 0, icon: <Users size={20} />, color: 'var(--accent-purple)' },
    { label: 'Upcoming Events', value: stats?.upcoming_events || 0, icon: <Calendar size={20} />, color: 'var(--accent-pink)' },
    { label: 'Total Bookings', value: stats?.total_bookings || 0, icon: <Ticket size={20} />, color: 'var(--accent-emerald)' },
    { label: 'Revenue', value: `₹${Number(stats?.total_revenue || 0).toLocaleString()}`, icon: <DollarSign size={20} />, color: 'var(--accent-gold)' },
  ];

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Shield size={28} style={{ color: 'var(--accent-purple)' }} />
            <div>
              <h1 className="page-title">Admin Dashboard</h1>
              <p className="page-subtitle">Platform management and statistics</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="dashboard-stats">
          {statCards.map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ color: s.color, marginBottom: 12 }}>{s.icon}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Recent Events */}
          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: 16 }}>All Events</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.slice(0, 8).map((ev: any) => (
                <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{ev.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{ev.organiser_name} · {ev.venue_name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: 'var(--accent-emerald)', fontSize: 13 }}>₹{Number(ev.revenue).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ev.bookings} bookings</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Users */}
          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: 16 }}>Users</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {users.slice(0, 8).map((u: any) => (
                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{u.email}</div>
                  </div>
                  <span className={`badge ${u.role === 'admin' ? 'badge-red' : u.role === 'organiser' ? 'badge-orange' : 'badge-purple'}`}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
