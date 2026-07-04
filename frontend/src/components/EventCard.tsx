
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Ticket } from 'lucide-react';
import { format } from 'date-fns';

interface Event {
  id: string;
  title: string;
  type: string;
  date_time: string;
  venue_name: string;
  city?: string;
  poster_url?: string;
  available_seats?: number;
  total_seats?: number;
}

const typeEmoji: Record<string, string> = {
  movie: '🎬',
  concert: '🎵',
  show: '🎭',
  sport: '⚽',
};

const typeBadgeClass: Record<string, string> = {
  movie: 'badge-purple',
  concert: 'badge-pink',
  show: 'badge-orange',
  sport: 'badge-emerald',
};

export default function EventCard({ event }: { event: Event }) {
  const available = Number(event.available_seats || 0);
  const total = Number(event.total_seats || 0);
  const soldOut = total > 0 && available === 0;
  const fillPercent = total > 0 ? Math.round(((total - available) / total) * 100) : 0;

  return (
    <Link to={`/events/${event.id}`} style={{ display: 'block' }}>
      <div className="event-card">
        {event.poster_url ? (
          <img src={event.poster_url} alt={event.title} className="event-card-img" />
        ) : (
          <div className="event-card-img-placeholder">
            {typeEmoji[event.type] || '🎟️'}
          </div>
        )}

        <div className="event-card-body">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.3, flex: 1 }}>{event.title}</h3>
            <span className={`badge ${typeBadgeClass[event.type] || 'badge-purple'}`} style={{ flexShrink: 0, fontSize: '10px' }}>
              {typeEmoji[event.type]} {event.type}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <Calendar size={13} />
              {format(new Date(event.date_time), 'EEE, MMM d • h:mm a')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <MapPin size={13} />
              {event.venue_name}{event.city ? `, ${event.city}` : ''}
            </div>
          </div>

          {total > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  <Ticket size={11} style={{ display: 'inline', marginRight: 4 }} />
                  {soldOut ? 'Sold Out' : `${available} seats left`}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{fillPercent}% filled</span>
              </div>
              <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${fillPercent}%`,
                  background: soldOut ? '#ff4757' : fillPercent > 80 ? 'var(--accent-orange)' : 'var(--accent-emerald)',
                  borderRadius: '2px',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )}

          {soldOut && (
            <div style={{ marginTop: 12, padding: '6px 12px', background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 8, textAlign: 'center', fontSize: 12, color: '#ff4757', fontWeight: 600 }}>
              🔴 Sold Out — Join Waitlist
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
