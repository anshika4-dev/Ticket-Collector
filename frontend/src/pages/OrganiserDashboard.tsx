import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PlusCircle, BarChart2, Calendar, Ticket, DollarSign, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { organiserAPI } from '../api';

export default function OrganiserDashboard() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['organiser-events'],
    queryFn: () => organiserAPI.events().then(r => r.data),
  });

  const totalRevenue = events.reduce((sum: number, e: any) => sum + Number(e.total_revenue || 0), 0);
  const totalBookings = events.reduce((sum: number, e: any) => sum + Number(e.confirmed_bookings || 0), 0);

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 className="page-title">Organiser Dashboard</h1>
              <p className="page-subtitle">Manage your events and view analytics</p>
            </div>
            <Link to="/organiser/create-event" className="btn btn-primary">
              <PlusCircle size={16} />
              Create Event
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="dashboard-stats">
          {[
            { label: 'My Events', value: events.length, icon: <Calendar size={20} />, color: 'var(--accent-purple)' },
            { label: 'Total Bookings', value: totalBookings, icon: <Ticket size={20} />, color: 'var(--accent-emerald)' },
            { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: <DollarSign size={20} />, color: 'var(--accent-gold)' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ color: s.color, marginBottom: 12 }}>{s.icon}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Events Table */}
        <div className="card">
          <h3 style={{ marginBottom: 20, fontSize: 16 }}>Your Events</h3>
          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎭</div>
              <p>No events yet. Create your first event!</p>
              <Link to="/organiser/create-event" className="btn btn-primary" style={{ marginTop: 16 }}>
                <PlusCircle size={14} /> Create Event
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Event', 'Date', 'Venue', 'Bookings', 'Revenue', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev: any) => (
                    <tr key={ev.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 12px', fontWeight: 600 }}>{ev.title}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-secondary)', fontSize: 13 }}>
                        {format(new Date(ev.date_time), 'MMM d, yyyy')}
                      </td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-secondary)', fontSize: 13 }}>{ev.venue_name}</td>
                      <td style={{ padding: '12px 12px', fontWeight: 700 }}>{ev.confirmed_bookings}</td>
                      <td style={{ padding: '12px 12px', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                        ₹{Number(ev.total_revenue).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span className={`badge ${ev.status === 'upcoming' ? 'badge-emerald' : 'badge-purple'}`}>{ev.status}</span>
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <Link to={`/organiser/events/${ev.id}/summary`} className="btn btn-secondary btn-sm">
                          <Eye size={12} /> Summary
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
