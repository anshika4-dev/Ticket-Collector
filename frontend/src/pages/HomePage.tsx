import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ticket, Zap, Shield, Clock, ArrowRight } from 'lucide-react';
import { eventsAPI } from '../api';
import EventCard from '../components/EventCard';

export default function HomePage() {
  const { data } = useQuery({
    queryKey: ['events', 'featured'],
    queryFn: () => eventsAPI.list({ limit: '6' }).then(r => r.data),
  });

  const events = data?.events || [];

  return (
    <main style={{ flex: 1 }}>
      {/* HERO */}
      <section className="hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(124,107,255,0.1)', border: '1px solid rgba(124,107,255,0.3)', borderRadius: 99, padding: '6px 16px', marginBottom: 24, fontSize: 13, color: 'var(--accent-purple)' }}>
            <Zap size={13} />
            Real-time seat selection · Instant booking
          </div>
          <h1 className="hero-title">
            Book Tickets for<br />
            <span className="gradient-text">Amazing Experiences</span>
          </h1>
          <p className="hero-sub">
            Browse movies, concerts & live shows. Pick your perfect seat on a real-time map.
            Get your QR code ticket instantly via email.
          </p>
          <div className="hero-cta">
            <Link to="/events" className="btn btn-primary btn-lg">
              Browse Events <ArrowRight size={16} />
            </Link>
            <Link to="/register" className="btn btn-secondary btn-lg">
              Create Account
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '60px 24px', background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
            {[
              { icon: <Ticket size={24} />, title: 'Visual Seat Map', desc: 'Pick your exact seat with a real-time interactive grid.' },
              { icon: <Clock size={24} />, title: '10-Min Hold', desc: 'Seats are held for 10 minutes while you complete checkout.' },
              { icon: <Zap size={24} />, title: 'Instant QR Ticket', desc: 'Get your QR code ticket immediately to your email.' },
              { icon: <Shield size={24} />, title: 'Waitlist System', desc: 'Join the waitlist for sold-out events. Auto-notified on cancellation.' },
            ].map((f) => (
              <div key={f.title} className="card" style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--accent-purple)', marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED EVENTS */}
      <section className="section">
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <div>
              <h2 className="section-title">Upcoming Events</h2>
              <p className="section-sub">Don't miss out on these experiences</p>
            </div>
            <Link to="/events" className="btn btn-secondary">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="events-grid">
            {events.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎭</div>
                <p>No upcoming events yet. Check back soon!</p>
              </div>
            ) : (
              events.map((event: any) => <EventCard key={event.id} event={event} />)
            )}
          </div>
        </div>
      </section>

    </main>
  );
}
