import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, ArrowRight, X, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { eventsAPI, seatsAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import SeatMap from '../components/SeatMap';

export default function SeatSelectionPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();


  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [selectedSeatData, setSelectedSeatData] = useState<any[]>([]);
  const [holdUntil, setHoldUntil] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isHolding, setIsHolding] = useState(false);

  // Seat map (poll every 15s for real-time updates)
  const { data: seats = [], refetch } = useQuery({
    queryKey: ['seats', eventId],
    queryFn: () => eventsAPI.getSeatMap(eventId!).then(r => r.data),
    refetchInterval: 15000,
    enabled: !!eventId,
  });

  const { data: eventData } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsAPI.get(eventId!).then(r => r.data),
    enabled: !!eventId,
  });

  // Check existing hold on mount
  const { data: existingHold } = useQuery({
    queryKey: ['my-hold', eventId],
    queryFn: () => seatsAPI.myHold(eventId!).then(r => r.data),
    enabled: !!eventId,
  });

  useEffect(() => {
    if (existingHold && existingHold.length > 0) {
      setSelectedSeats(existingHold.map((s: any) => s.id));
      setSelectedSeatData(existingHold);
      setHoldUntil(new Date(existingHold[0].held_until));
    }
  }, [existingHold]);

  // Countdown timer
  useEffect(() => {
    if (!holdUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((holdUntil.getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        setSelectedSeats([]);
        setSelectedSeatData([]);
        setHoldUntil(null);
        refetch();
        toast.error('Hold expired. Please re-select your seats.');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [holdUntil, refetch]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleToggleSeat = async (seatId: string, seat: any) => {
    const newSelected = selectedSeats.includes(seatId)
      ? selectedSeats.filter(id => id !== seatId)
      : [...selectedSeats, seatId];

    const newSeatData = selectedSeats.includes(seatId)
      ? selectedSeatData.filter(s => s.id !== seatId)
      : [...selectedSeatData, seat];

    setSelectedSeats(newSelected);
    setSelectedSeatData(newSeatData);

    // Place hold when seats are selected
    if (newSelected.length > 0) {
      setIsHolding(true);
      try {
        const res = await seatsAPI.hold(eventId!, newSelected);
        setHoldUntil(new Date(res.data.held_until));
        setTimeLeft(res.data.ttl_minutes * 60);
      } catch (err: any) {
        toast.error(err.response?.data?.error || 'Failed to hold seat');
        setSelectedSeats(selectedSeats);
        setSelectedSeatData(selectedSeatData);
      } finally {
        setIsHolding(false);
        refetch();
      }
    } else {
      // Release all holds
      await seatsAPI.release(eventId!);
      setHoldUntil(null);
      refetch();
    }
  };

  const handleRelease = async () => {
    await seatsAPI.release(eventId!);
    setSelectedSeats([]);
    setSelectedSeatData([]);
    setHoldUntil(null);
    refetch();
    toast.success('Seats released');
  };

  const totalPrice = selectedSeatData.reduce((sum, s) => sum + Number(s.price || 0), 0);

  const handleProceedToCheckout = () => {
    if (selectedSeats.length === 0) { toast.error('Please select at least one seat'); return; }
    sessionStorage.setItem('checkout_data', JSON.stringify({
      eventId,
      seatIds: selectedSeats,
      seats: selectedSeatData,
      totalPrice,
      holdUntil: holdUntil?.toISOString(),
    }));
    navigate('/checkout');
  };

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">{eventData?.title || 'Select Seats'}</h1>
          <p className="page-subtitle">Click on a seat to select it. Seats are held for 10 minutes.</p>
        </div>

        {/* Hold timer */}
        {holdUntil && timeLeft > 0 && (
          <div className="hold-timer" style={{ marginBottom: 24 }}>
            <Clock size={16} />
            <span>Hold expires in: <strong>{formatTime(timeLeft)}</strong></span>
            <button onClick={handleRelease} style={{ marginLeft: 'auto', color: 'var(--text-muted)', padding: 2 }}>
              <X size={14} />
            </button>
          </div>
        )}

        <div className="seat-selection-layout">
          {/* Seat Map */}
          <div className="card" style={{ overflowX: 'auto' }}>
            {seats.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                Loading seat map...
              </div>
            ) : (
              <SeatMap
                seats={seats}
                selectedSeats={selectedSeats}
                onToggleSeat={handleToggleSeat}
                currentUserId={user?.id}
                maxSelectable={8}
                disabled={isHolding}
              />
            )}
          </div>

          {/* Selection Summary */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <ShoppingCart size={18} />
                <h3 style={{ fontSize: 16 }}>Your Selection</h3>
              </div>

              {selectedSeatData.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
                  No seats selected yet.<br />Click on a green seat to select it.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {selectedSeatData.map((seat: any) => (
                      <div key={seat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-glass)', borderRadius: 8 }}>
                        <div>
                          <span style={{ fontWeight: 700 }}>{seat.label}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>{seat.category_name}</span>
                        </div>
                        <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>₹{seat.price}</span>
                      </div>
                    ))}
                  </div>

                  <div className="divider" />

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 18, fontWeight: 700 }}>
                    <span>Total</span>
                    <span className="gradient-text">₹{totalPrice.toFixed(2)}</span>
                  </div>
                </>
              )}

              <button
                className="btn btn-primary w-full"
                onClick={handleProceedToCheckout}
                disabled={selectedSeats.length === 0 || isHolding}
              >
                {isHolding ? 'Holding...' : 'Proceed to Checkout'}
                <ArrowRight size={16} />
              </button>

              {holdUntil && timeLeft > 0 && (
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--accent-gold)', marginTop: 10 }}>
                  ⏰ Complete checkout in {formatTime(timeLeft)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
