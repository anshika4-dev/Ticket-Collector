import React from 'react';

interface Seat {
  id: string;
  status: 'available' | 'held' | 'booked';
  price: number;
  held_until?: string;
  row_num: number;
  col_num: number;
  label: string;
  category_name?: string;
  category_color?: string;
  category_id?: string;
}

interface SeatMapProps {
  seats: Seat[];
  selectedSeats: string[];
  onToggleSeat: (seatId: string, seat: Seat) => void;
  currentUserId?: string;
  maxSelectable?: number;
}

export default function SeatMap({ seats, selectedSeats, onToggleSeat, maxSelectable = 10 }: SeatMapProps) {
  const rows = Math.max(...seats.map(s => s.row_num), 0);
  const cols = Math.max(...seats.map(s => s.col_num), 0);

  const seatMap: Record<string, Seat> = {};
  seats.forEach(s => { seatMap[`${s.row_num}-${s.col_num}`] = s; });

  const getSeatClass = (seat: Seat) => {
    if (selectedSeats.includes(seat.id)) return 'seat seat-selected';
    if (seat.status === 'booked') return 'seat seat-booked';
    if (seat.status === 'held') return 'seat seat-held';
    return 'seat seat-available';
  };

  const handleClick = (seat: Seat) => {
    if (seat.status === 'booked' || seat.status === 'held') return;
    if (!selectedSeats.includes(seat.id) && selectedSeats.length >= maxSelectable) {
      return; // Max reached
    }
    onToggleSeat(seat.id, seat);
  };

  // Get unique categories for legend
  const categories = [...new Map(
    seats.filter(s => s.category_id).map(s => [s.category_id, { name: s.category_name, color: s.category_color, price: s.price }])
  ).values()];

  const rowLetters = (r: number) => String.fromCharCode(64 + r);

  return (
    <div>
      {/* Screen */}
      <div style={{
        textAlign: 'center',
        marginBottom: '32px',
        position: 'relative',
      }}>
        <div style={{
          background: 'linear-gradient(180deg, rgba(124,107,255,0.4) 0%, transparent 100%)',
          height: '6px',
          borderRadius: '3px 3px 0 0',
          maxWidth: '400px',
          margin: '0 auto 8px',
        }} />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '3px' }}>
          SCREEN
        </span>
      </div>

      {/* Seat grid */}
      <div className="seat-map-wrapper">
        <div className="seat-grid" style={{ gridTemplateColumns: `auto repeat(${cols}, 36px)` }}>
          {Array.from({ length: rows }, (_, ri) => {
            const rowNum = ri + 1;
            return (
              <React.Fragment key={rowNum}>
                {/* Row label */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  fontWeight: 700,
                  paddingRight: '8px',
                }}>
                  {rowLetters(rowNum)}
                </div>
                {/* Seats in this row */}
                {Array.from({ length: cols }, (_, ci) => {
                  const colNum = ci + 1;
                  const seat = seatMap[`${rowNum}-${colNum}`];
                  if (!seat) {
                    return <div key={`${rowNum}-${colNum}`} style={{ width: 36, height: 36 }} />;
                  }
                  return (
                    <div
                      key={seat.id}
                      className={getSeatClass(seat)}
                      onClick={() => handleClick(seat)}
                      title={`${seat.label} — ${seat.category_name || 'Standard'} — ₹${seat.price}`}
                      style={{
                        borderColor: selectedSeats.includes(seat.id) ? 'var(--accent-purple)' :
                          seat.status === 'available' ? (seat.category_color || '#00d97e') : undefined,
                        background: selectedSeats.includes(seat.id) ? 'rgba(124,107,255,0.3)' :
                          seat.status === 'available' ? `${seat.category_color || '#00d97e'}22` : undefined,
                        color: selectedSeats.includes(seat.id) ? 'var(--accent-purple)' :
                          seat.status === 'available' ? (seat.category_color || '#00d97e') : undefined,
                      }}
                    >
                      {seat.col_num}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="seat-legend">
        <div className="seat-legend-item">
          <div className="seat-legend-dot" style={{ background: 'rgba(0,217,126,0.15)', borderColor: '#00d97e' }} />
          Available
        </div>
        <div className="seat-legend-item">
          <div className="seat-legend-dot" style={{ background: 'rgba(124,107,255,0.3)', borderColor: 'var(--accent-purple)' }} />
          Selected
        </div>
        <div className="seat-legend-item">
          <div className="seat-legend-dot" style={{ background: 'rgba(255,215,0,0.15)', borderColor: 'var(--accent-gold)' }} />
          Held
        </div>
        <div className="seat-legend-item">
          <div className="seat-legend-dot" style={{ background: 'rgba(255,255,255,0.05)', borderColor: '#333' }} />
          Booked
        </div>
      </div>

      {/* Category prices */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '20px' }}>
          {categories.map((cat: any) => (
            <div key={cat.name} style={{
              background: `${cat.color}15`,
              border: `1px solid ${cat.color}50`,
              borderRadius: '8px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: cat.color }} />
              <span style={{ color: cat.color, fontSize: '13px', fontWeight: 600 }}>{cat.name}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>₹{cat.price}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
