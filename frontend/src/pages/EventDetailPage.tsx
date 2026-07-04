import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, MapPin, Clock, Users, ArrowRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { eventsAPI, waitlistAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [joiningWaitlist, setJoiningWaitlist] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsAPI.get(id!).then(r => r.data),
    enabled: !!id,
  });

  const soldOut = data && Number(data.available_seats) === 0 && Number(data.total_seats) > 0;

  const joinWaitlist = async (categoryId: string) => {
    if (!user) { navigate('/login'); return; }
    setJoiningWaitlist(categoryId);
    try {
      await waitlistAPI.join(id!, categoryId);
      toast.success('Added to waitlist! You\'ll be notified when a seat becomes available.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to join waitlist');
    } finally {
      setJoiningWaitlist(null);
    }
  };

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="spinner" />
    </div>
  );

  if (!data) return <div className="page"><div className="container"><p>Event not found.</p></div></div>;

  const typeEmoji: Record<string, string> = { movie: '🎬', concert: '🎵', show: '🎭', sport: '⚽' };
  const typeBadge: Record<string, string> = { movie: 'badge-purple', concert: 'badge-pink', show: 'badge-orange', sport: 'badge-emerald' };

  return (
    <main className="page">
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32, alignItems: 'start' }}>
          {/* Left: Event Info */}
          <div>
            {/* Poster */}
            {data.poster_url ? (
              <img src={data.poster_url} alt={data.title} style={{ width: '100%', height: 320, objectFit: 'cover', borderRadius: 'var(--radius-lg)', marginBottom: 24 }} />
            ) : (
              <div style={{ width: '100%', height: 320, background: 'linear-gradient(135deg, #1a1a3e, #2a1a4e)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80, marginBottom: 24 }}>
                {typeEmoji[data.type] || '🎟️'}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span className={`badge ${typeBadge[data.type] || 'badge-purple'}`}>
                {typeEmoji[data.type]} {data.type}
              </span>
            </div>

            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>{data.title}</h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' }}>
                <Calendar size={16} />
                {format(new Date(data.date_time), 'EEEE, MMMM d, yyyy')} at {format(new Date(data.date_time), 'h:mm a')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' }}>
                <MapPin size={16} />
                {data.venue_name}{data.city ? `, ${data.city}` : ''}
                {data.address && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>· {data.address}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' }}>
                <Clock size={16} />
                Duration: {data.duration_minutes} minutes
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' }}>
                <Users size={16} />
                {data.available_seats} of {data.total_seats} seats available
              </div>
            </div>

            {data.description && (
              <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 12, fontSize: 16 }}>About this event</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{data.description}</p>
              </div>
            )}

            {/* Category Prices */}
            {data.category_prices?.length > 0 && (
              <div className="card">
                <h3 style={{ marginBottom: 16, fontSize: 16 }}>Ticket Prices</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.category_prices.map((cp: any) => (
                    <div key={cp.category_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: `${cp.color}15`, border: `1px solid ${cp.color}30`, borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: cp.color }} />
                        <span style={{ fontWeight: 600 }}>{cp.category_name}</span>
                      </div>
                      <span style={{ color: cp.color, fontWeight: 700, fontSize: 18 }}>₹{cp.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Booking Panel */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div className="card" style={{ textAlign: 'center' }}>
              {soldOut ? (
                <>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>😔</div>
                  <h3 style={{ fontSize: 18, marginBottom: 8 }}>Sold Out</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
                    All seats are booked. Join the waitlist and we'll notify you if a seat becomes available.
                  </p>
                  {data.category_prices?.map((cp: any) => (
                    <button
                      key={cp.category_id}
                      className="btn btn-secondary w-full"
                      style={{ marginBottom: 8 }}
                      onClick={() => joinWaitlist(cp.category_id)}
                      disabled={joiningWaitlist === cp.category_id}
                    >
                      {joiningWaitlist === cp.category_id ? <Loader2 size={14} className="animate-spin" /> : null}
                      Join Waitlist — {cp.category_name}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎟️</div>
                  <h3 style={{ fontSize: 18, marginBottom: 8 }}>Select Your Seats</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
                    Choose from {data.available_seats} available seats. Held for 10 minutes during checkout.
                  </p>
                  {user ? (
                    <Link to={`/events/${id}/seats`} className="btn btn-primary w-full">
                      Pick Seats <ArrowRight size={16} />
                    </Link>
                  ) : (
                    <Link to="/login" className="btn btn-primary w-full">
                      Login to Book <ArrowRight size={16} />
                    </Link>
                  )}
                </>
              )}
              <div className="divider" />
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                🔒 Secure booking · QR ticket via email
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
