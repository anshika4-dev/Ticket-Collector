import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, CheckCircle, Loader2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { bookingsAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function CheckoutPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [done, setDone] = useState(false);
  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('checkout_data');
    if (!raw) { navigate('/events'); return; }
    const data = JSON.parse(raw);
    setCheckoutData(data);

    // Countdown from holdUntil
    if (data.holdUntil) {
      const interval = setInterval(() => {
        const rem = Math.max(0, Math.floor((new Date(data.holdUntil).getTime() - Date.now()) / 1000));
        setTimeLeft(rem);
        if (rem === 0) {
          clearInterval(interval);
          toast.error('Hold expired! Please re-select seats.');
          navigate(`/events/${data.eventId}/seats`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [navigate]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const handleConfirmBooking = async () => {
    if (!checkoutData) return;
    setLoading(true);
    try {
      const res = await bookingsAPI.create({
        event_id: checkoutData.eventId,
        seat_ids: checkoutData.seatIds,
        payment_method: paymentMethod,
      });
      sessionStorage.removeItem('checkout_data');
      setBooking(res.data.booking);
      setDone(true);
      toast.success('Booking confirmed! Check your email for the QR ticket.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done && booking) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ marginBottom: 24 }}>
            <CheckCircle size={72} color="var(--accent-emerald)" style={{ margin: '0 auto' }} />
          </div>
          <h1 style={{ fontSize: 32, marginBottom: 12 }}>Booking Confirmed! 🎉</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
            Your ticket has been sent to <strong>{user?.email}</strong> with a QR code.
          </p>
          <div style={{ background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.3)', borderRadius: 8, padding: 12, marginBottom: 24, display: 'inline-block' }}>
            <p style={{ color: '#ffb347', margin: 0, fontSize: 14 }}>
              ⚠️ Please check your <strong>Spam</strong> or <strong>Promotions</strong> folder if you don't see it in your inbox!
            </p>
          </div>
          <div className="card" style={{ textAlign: 'left', marginBottom: 24 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginBottom: 8, letterSpacing: 2, textTransform: 'uppercase' }}>Booking Reference</p>
            <p style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', color: 'var(--accent-purple)', letterSpacing: 4 }}>{booking.booking_ref}</p>
            <div className="divider" />
            <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
              Total paid: <strong style={{ color: 'var(--text-primary)' }}>₹{Number(booking.total_price).toFixed(2)}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/bookings')}>View My Bookings</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate('/events')}>Browse More Events</button>
          </div>
        </div>
      </main>
    );
  }

  if (!checkoutData) return null;

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="page-header">
          <h1 className="page-title">Checkout</h1>
        </div>

        {/* Hold timer */}
        {timeLeft > 0 && (
          <div className="hold-timer" style={{ marginBottom: 24 }}>
            <Clock size={16} />
            <span>Your seats are held for: <strong>{formatTime(timeLeft)}</strong></span>
          </div>
        )}

        {/* Order Summary */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>Order Summary</h3>
          {checkoutData.seats.map((seat: any) => (
            <div key={seat.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <span style={{ fontWeight: 600 }}>{seat.label}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 13, marginLeft: 8 }}>{seat.category_name}</span>
              </div>
              <span>₹{Number(seat.price).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 20, fontWeight: 700 }}>
            <span>Total</span>
            <span className="gradient-text">₹{Number(checkoutData.totalPrice).toFixed(2)}</span>
          </div>
        </div>

        {/* Customer Details */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>Customer Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Name</span>
              <span style={{ fontWeight: 600 }}>{user?.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Email</span>
              <span style={{ fontWeight: 600 }}>{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>
            <CreditCard size={16} style={{ display: 'inline', marginRight: 8 }} />
            Payment Method
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['card', 'upi', 'netbanking', 'wallet'].map(method => (
              <label key={method} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: paymentMethod === method ? 'rgba(124,107,255,0.1)' : 'var(--bg-glass)', border: `1px solid ${paymentMethod === method ? 'var(--accent-purple)' : 'var(--border-subtle)'}`, borderRadius: 10, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="payment"
                  value={method}
                  checked={paymentMethod === method}
                  onChange={() => setPaymentMethod(method)}
                  style={{ width: 'auto', accentColor: 'var(--accent-purple)' }}
                />
                <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                  {method === 'card' ? '💳 Credit / Debit Card' :
                   method === 'upi' ? '📱 UPI' :
                   method === 'netbanking' ? '🏦 Net Banking' : '💰 Wallet'}
                </span>
              </label>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
            ⚠️ Demo mode — no real payment is processed.
          </p>
        </div>

        <button
          className="btn btn-primary btn-lg w-full"
          onClick={handleConfirmBooking}
          disabled={loading}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : null}
          {loading ? 'Confirming...' : `Confirm Booking — ₹${Number(checkoutData.totalPrice).toFixed(2)}`}
        </button>
      </div>
    </main>
  );
}
