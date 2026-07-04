import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';
import { eventsAPI } from '../api';
import EventCard from '../components/EventCard';

const TYPES = ['All', 'movie', 'concert', 'show', 'sport'];

export default function EventListPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('All');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), limit: '12' };
  if (search) params.search = search;
  if (type !== 'All') params.type = type;
  if (city) params.city = city;

  const { data, isLoading } = useQuery({
    queryKey: ['events', params],
    queryFn: () => eventsAPI.list(params).then(r => r.data),
    staleTime: 15000,
  });

  const events = data?.events || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 12);

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Browse Events</h1>
          <p className="page-subtitle">{total > 0 ? `${total} events available` : 'Find something amazing'}</p>
        </div>

        {/* Filters */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          marginBottom: '32px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}>
          <div className="form-group" style={{ flex: '1 1 200px' }}>
            <label className="form-label"><Search size={12} style={{ display: 'inline', marginRight: 4 }} />Search</label>
            <input
              placeholder="Search events..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="form-group" style={{ flex: '1 1 160px' }}>
            <label className="form-label">Type</label>
            <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
              {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1 1 160px' }}>
            <label className="form-label">City</label>
            <input
              placeholder="Filter by city..."
              value={city}
              onChange={e => { setCity(e.target.value); setPage(1); }}
            />
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => { setSearch(''); setType('All'); setCity(''); setPage(1); }}
          >
            Clear Filters
          </button>
        </div>

        {/* Results */}
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div className="skeleton" style={{ height: 200 }} />
                <div style={{ padding: 20, background: 'var(--bg-card)' }}>
                  <div className="skeleton" style={{ height: 20, marginBottom: 12 }} />
                  <div className="skeleton" style={{ height: 14, width: '60%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
            <h3 style={{ fontSize: 20, marginBottom: 8, color: 'var(--text-secondary)' }}>No events found</h3>
            <p>Try different search terms or filters</p>
          </div>
        ) : (
          <div className="events-grid">
            {events.map((event: any) => <EventCard key={event.id} event={event} />)}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 40 }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                className={`btn btn-sm ${page === i + 1 ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </main>
  );
}
