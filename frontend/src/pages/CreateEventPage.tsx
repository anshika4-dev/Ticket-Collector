import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PlusCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { eventsAPI, venuesAPI } from '../api';

interface CategoryPrice { category_id: string; price: string; }

export default function CreateEventPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', type: 'movie', description: '', poster_url: '',
    venue_id: '', date_time: '', duration_minutes: '120',
  });
  const [categoryPrices, setCategoryPrices] = useState<CategoryPrice[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: venues = [] } = useQuery({
    queryKey: ['venues'],
    queryFn: () => venuesAPI.list().then(r => r.data),
  });

  // Load venue categories when venue changes
  const { data: venueData } = useQuery({
    queryKey: ['venue', form.venue_id],
    queryFn: () => venuesAPI.get(form.venue_id).then(r => r.data),
    enabled: !!form.venue_id,
  });

  useEffect(() => {
    if (venueData?.categories) {
      setCategoryPrices(venueData.categories.map((c: any) => ({ category_id: c.id, price: '500' })));
    }
  }, [venueData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.venue_id) { toast.error('Please select a venue'); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        duration_minutes: parseInt(form.duration_minutes),
        category_prices: categoryPrices.map(cp => ({ ...cp, price: parseFloat(cp.price) })),
      };
      await eventsAPI.create(payload);
      toast.success('Event created successfully! 🎉');
      navigate('/organiser');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const updateCategoryPrice = (categoryId: string, price: string) => {
    setCategoryPrices(prev => prev.map(cp => cp.category_id === categoryId ? { ...cp, price } : cp));
  };

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 700 }}>
        <div className="page-header">
          <h1 className="page-title">Create New Event</h1>
          <p className="page-subtitle">Set up a movie, concert, or live show</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Basic Details */}
          <div className="card">
            <h3 style={{ marginBottom: 20, fontSize: 16 }}>Event Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Event Title *</label>
                <input placeholder="e.g. Coldplay World Tour 2026" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Event Type *</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="movie">🎬 Movie</option>
                  <option value="concert">🎵 Concert</option>
                  <option value="show">🎭 Show</option>
                  <option value="sport">⚽ Sport</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Duration (minutes)</label>
                <input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} min="30" max="600" />
              </div>
              <div className="form-group">
                <label className="form-label">Date & Time *</label>
                <input type="datetime-local" value={form.date_time} onChange={e => setForm(f => ({ ...f, date_time: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Venue *</label>
                <select value={form.venue_id} onChange={e => setForm(f => ({ ...f, venue_id: e.target.value }))} required>
                  <option value="">Select a venue...</option>
                  {venues.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.name} — {v.city || 'No city'} ({v.seat_count || 0} seats)</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Poster URL (optional)</label>
                <input placeholder="https://..." value={form.poster_url} onChange={e => setForm(f => ({ ...f, poster_url: e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Description</label>
                <textarea
                  placeholder="Describe your event..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  style={{ minHeight: '100px', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Category Pricing */}
          {categoryPrices.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 16, fontSize: 16 }}>Ticket Pricing per Category</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {venueData?.categories?.map((cat: any) => {
                  const cp = categoryPrices.find(c => c.category_id === cat.id);
                  return (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: `${cat.color}10`, border: `1px solid ${cat.color}30`, borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 4, background: cat.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{cat.name}</span>
                        {cat.description && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cat.description}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>₹</span>
                        <input
                          type="number"
                          value={cp?.price || ''}
                          onChange={e => updateCategoryPrice(cat.id, e.target.value)}
                          style={{ width: '100px' }}
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/organiser')}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? <Loader2 size={16} /> : <PlusCircle size={16} />}
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
