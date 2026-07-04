import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, MapPin, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { bookingsAPI } from '../api';

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsAPI.get(id!).then(r => r.data),
    enabled: !!id,
  });

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner" /></div>;
  if (!booking) return <div className="page"><p>Booking not found.</p></div>;

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 600 }}>
        <Link to="/bookings" className="btn btn-secondary btn-sm" style={{ marginBottom: 24 }}>
          <ArrowLeft size={14} /> Back to Bookings
        </Link>

        <div className="card" style={{ textAlign: 'center', marginBottom: 24 }}>
          <span className={`badge ${booking.status === 'confirmed' ? 'badge-emerald' : 'badge-red'}`} style={{ marginBottom: 12 }}>
            {booking.status}
          </span>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>{booking.event_title}</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
              <Calendar size={14} />
              {format(new Date(booking.date_time), 'EEEE, MMMM d, yyyy • h:mm a')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
              <MapPin size={14} />
              {booking.venue_name}{booking.city ? `, ${booking.city}` : ''}
            </div>
          </div>
          <div style={{ background: 'var(--bg-glass)', borderRadius: 12, padding: '16px 24px', display: 'inline-block' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>Booking Ref</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-purple)', letterSpacing: 4 }}>{booking.booking_ref}</p>
          </div>
        </div>

        {/* QR Code */}
        {booking.qr_code_data && (
          <div className="card" style={{ textAlign: 'center', marginBottom: 24 }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>Show this QR code at the venue</p>
            <img
              src={booking.qr_code_data}
              alt="QR Code"
              style={{ width: 200, height: 200, borderRadius: 12, border: '3px solid var(--accent-purple)', margin: '0 auto' }}
            />
          </div>
        )}

        {/* Seats */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>Booked Seats</h3>
          {booking.seats?.map((seat: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <span style={{ fontWeight: 700 }}>{seat.label}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>{seat.category}</span>
              </div>
              <span>₹{Number(seat.price).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontWeight: 700, fontSize: 18 }}>
            <span>Total</span>
            <span className="gradient-text">₹{Number(booking.total_price).toFixed(2)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/bookings" className="btn btn-secondary" style={{ flex: 1 }}>All Bookings</Link>
          <Link to="/events" className="btn btn-primary" style={{ flex: 1 }}>Book More</Link>
        </div>
      </div>
    </main>
  );
}
