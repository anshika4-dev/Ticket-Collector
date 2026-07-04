import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { waitlistAPI } from '../api';

export default function WaitlistClaimPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    waitlistAPI.claim(token)
      .then(res => {
        setData(res.data);
        setStatus('success');
        toast.success('Seat claimed! Complete your booking.');
      })
      .catch(err => {
        setError(err.response?.data?.error || 'This offer has expired or already been claimed.');
        setStatus('error');
      });
  }, [token]);

  return (
    <main className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        {status === 'loading' && (
          <>
            <Loader2 size={56} style={{ margin: '0 auto 16px', color: 'var(--accent-purple)', animation: 'spin 1s linear infinite' }} />
            <h2>Claiming your seat...</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={72} style={{ margin: '0 auto 16px', color: 'var(--accent-emerald)' }} />
            <h2 style={{ fontSize: 28, marginBottom: 12 }}>Seat Claimed! 🎉</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              Your seat is held. Complete your booking within 10 minutes!
            </p>
            <div className="card" style={{ marginBottom: 24 }}>
              <p style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>⏰ Hold expires soon — act fast!</p>
            </div>
            <button
              className="btn btn-primary btn-lg w-full"
              onClick={() => {
                sessionStorage.setItem('checkout_data', JSON.stringify({
                  eventId: data.event_id,
                  seatIds: [data.show_seat_id],
                  seats: [{ id: data.show_seat_id, label: 'Waitlist Seat', price: 0 }],
                  totalPrice: 0,
                  holdUntil: data.held_until,
                }));
                navigate(`/events/${data.event_id}/seats`);
              }}
            >
              Select Seat & Checkout →
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={72} style={{ margin: '0 auto 16px', color: '#ff4757' }} />
            <h2 style={{ fontSize: 28, marginBottom: 12 }}>Offer Expired</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{error}</p>
            <button className="btn btn-primary w-full" onClick={() => navigate('/events')}>
              Browse Other Events
            </button>
          </>
        )}
      </div>
    </main>
  );
}
