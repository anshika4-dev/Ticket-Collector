import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, X, Eye } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { bookingsAPI } from '../api';

export default function MyBookingsPage() {
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => bookingsAPI.my().then(r => r.data),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => bookingsAPI.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      toast.success('Booking cancelled. The seat is now available for others.');
      setCancellingId(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Cancellation failed');
      setCancellingId(null);
    },
  });

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) return;
    setCancellingId(bookingId);
    cancelMutation.mutate(bookingId);
  };

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">My Tickets</h1>
          <p className="page-subtitle">Your booking history</p>
        </div>

        {bookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎟️</div>
            <h3 style={{ fontSize: 20, color: 'var(--text-secondary)', marginBottom: 12 }}>No bookings yet</h3>
            <p style={{ marginBottom: 24 }}>Browse events and book your first ticket!</p>
            <Link to="/events" className="btn btn-primary">Browse Events</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {bookings.map((booking: any) => (
              <div key={booking.id} className="card" style={{
                borderColor: booking.status === 'cancelled' ? 'rgba(255,71,87,0.2)' : 'var(--border-subtle)',
                opacity: booking.status === 'cancelled' ? 0.7 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: 18, fontWeight: 700 }}>{booking.event_title}</h3>
                      <span className={`badge ${booking.status === 'confirmed' ? 'badge-emerald' : 'badge-red'}`}>
                        {booking.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
                        <Calendar size={13} />
                        {format(new Date(booking.date_time), 'EEE, MMM d, yyyy • h:mm a')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
                        <MapPin size={13} />
                        {booking.venue_name}{booking.city ? `, ${booking.city}` : ''}
                      </div>
                    </div>

                    {/* Seats */}
                    {booking.seats && booking.seats[0] && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {booking.seats.map((seat: any, i: number) => seat && (
                          <span key={i} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                            {seat.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block' }}>Booking Ref</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent-purple)', fontSize: 14 }}>{booking.booking_ref}</span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>
                      ₹{Number(booking.total_price).toFixed(2)}
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <Link to={`/bookings/${booking.id}`} className="btn btn-secondary btn-sm">
                        <Eye size={13} /> Details
                      </Link>
                      {booking.status === 'confirmed' && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleCancel(booking.id)}
                          disabled={cancellingId === booking.id}
                        >
                          <X size={13} />
                          {cancellingId === booking.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
