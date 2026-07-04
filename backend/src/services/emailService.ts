import QRCode from 'qrcode';
import pool from '../config/db';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzgt2QmKw4c9jnitMkYbBicALJ6ZiG_ngb1ds3CJp8gW_bDbYFnw188Q_btdpaASbE7KQ/exec';

interface BookingEmailData {
  booking: {
    id: string;
    booking_ref: string;
    total_price: number;
    created_at: Date;
  };
  user: { name: string; email: string };
  event: {
    title: string;
    type: string;
    date_time: string;
    venue_name: string;
    city: string;
    poster_url?: string;
  };
  seats: Array<{ label: string; category_name: string; price: number }>;
}

export async function sendBookingConfirmation(data: BookingEmailData): Promise<void> {
  const { booking, user, event, seats } = data;

  // Generate QR code as base64 PNG
  const qrData = JSON.stringify({
    ref: booking.booking_ref,
    event: event.title,
    date: event.date_time,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300,
  });

  // Extract base64 content for inline embedding
  const qrBase64 = qrCodeDataUrl.split(',')[1];

  // Update booking with QR data
  await pool.query(
    'UPDATE bookings SET qr_code_data = $1 WHERE id = $2',
    [qrCodeDataUrl, booking.id]
  );

  const seatList = seats.map(s => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #333;">${s.label}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #333;">${s.category_name || 'Standard'}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #333;">₹${Number(s.price).toFixed(2)}</td>
    </tr>
  `).join('');

  const eventDate = new Date(event.date_time).toLocaleString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6c63ff,#ff6584);border-radius:16px 16px 0 0;padding:40px 30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:1px;">🎟️ Booking Confirmed!</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;">Your ticket is ready</p>
    </div>

    <!-- Body -->
    <div style="background:#1a1a2e;padding:30px;border-left:1px solid #333;border-right:1px solid #333;">
      <p style="color:#ccc;font-size:16px;">Hi <strong style="color:#fff;">${user.name}</strong>,</p>
      <p style="color:#ccc;">Your booking is confirmed! Show the QR code below at the venue entrance.</p>

      <!-- Booking Ref -->
      <div style="background:#0f0f23;border:1px solid #6c63ff;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
        <p style="color:#888;margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Booking Reference</p>
        <p style="color:#6c63ff;font-size:28px;font-weight:700;margin:0;letter-spacing:3px;">${booking.booking_ref}</p>
      </div>

      <!-- Event Details -->
      <div style="background:#0f0f23;border-radius:12px;padding:20px;margin:20px 0;">
        <h2 style="color:#fff;margin:0 0 16px;font-size:20px;">${event.title}</h2>
        <p style="color:#aaa;margin:6px 0;">📅 ${eventDate}</p>
        <p style="color:#aaa;margin:6px 0;">📍 ${event.venue_name}${event.city ? ', ' + event.city : ''}</p>
        <p style="color:#aaa;margin:6px 0;">🎭 ${event.type.charAt(0).toUpperCase() + event.type.slice(1)}</p>
      </div>

      <!-- Seats Table -->
      <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#0f0f23;border-radius:12px;overflow:hidden;">
        <thead>
          <tr style="background:#6c63ff;">
            <th style="padding:10px 12px;color:#fff;text-align:left;font-size:13px;">Seat</th>
            <th style="padding:10px 12px;color:#fff;text-align:left;font-size:13px;">Category</th>
            <th style="padding:10px 12px;color:#fff;text-align:left;font-size:13px;">Price</th>
          </tr>
        </thead>
        <tbody style="color:#ccc;">
          ${seatList}
        </tbody>
        <tfoot>
          <tr style="background:#1a1a2e;">
            <td colspan="2" style="padding:10px 12px;color:#fff;font-weight:700;">Total</td>
            <td style="padding:10px 12px;color:#6c63ff;font-weight:700;font-size:16px;">₹${Number(booking.total_price).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- QR Code -->
      <div style="text-align:center;margin:30px 0;">
        <p style="color:#aaa;margin:0 0 16px;font-size:14px;">Scan at entrance</p>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}" alt="QR Code" style="width:200px;height:200px;border-radius:12px;border:4px solid #6c63ff;" />
        <p style="color:#666;margin:12px 0 0;font-size:12px;">Booking ID: ${booking.id}</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#111;border-radius:0 0 16px 16px;padding:20px 30px;text-align:center;border:1px solid #222;border-top:none;">
      <p style="color:#555;font-size:12px;margin:0;">TicketCollector — Your gateway to amazing experiences</p>
      <p style="color:#555;font-size:11px;margin:8px 0 0;">If you have issues, contact support. This ticket is non-transferable.</p>
    </div>
  </div>
</body>
</html>
  `;

  console.log(`✉️ Attempting to send booking email to: ${user.email} via Google Apps Script...`);
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: user.email,
        subject: `🎟️ Booking Confirmed — ${event.title} [${booking.booking_ref}]`,
        html
      })
    });
    
    if (!response.ok) {
      throw new Error(`Google Script returned ${response.status}`);
    }
    const result = (await response.json()) as any;
    if (result.error) {
      throw new Error(result.error);
    }
    
    console.log(`✅ Email sent successfully to ${user.email} via Google Apps Script`);
  } catch (err: any) {
    console.error(`❌ Failed to send email to ${user.email}:`, err.message);
    throw err;
  }
}

export async function sendWaitlistOffer(data: {
  user: { name: string; email: string };
  event: { title: string; date_time: string; venue_name: string };
  categoryName: string;
  claimUrl: string;
  expiresAt: Date;
}): Promise<void> {
  const { user, event, categoryName, claimUrl, expiresAt } = data;

  const expiresIn = Math.round((expiresAt.getTime() - Date.now()) / 60000);
  const eventDate = new Date(event.date_time).toLocaleString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:linear-gradient(135deg,#ff6584,#ffb347);border-radius:16px 16px 0 0;padding:40px 30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:26px;">🎉 You're Up!</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;">A seat is available for you</p>
    </div>
    <div style="background:#1a1a2e;padding:30px;border:1px solid #333;">
      <p style="color:#ccc;">Hi <strong style="color:#fff;">${user.name}</strong>,</p>
      <p style="color:#ccc;">Great news! A <strong style="color:#ff6584;">${categoryName}</strong> seat has become available for:</p>
      <div style="background:#0f0f23;border-radius:12px;padding:20px;margin:20px 0;">
        <h2 style="color:#fff;margin:0 0 10px;">${event.title}</h2>
        <p style="color:#aaa;margin:4px 0;">📅 ${eventDate}</p>
        <p style="color:#aaa;margin:4px 0;">📍 ${event.venue_name}</p>
      </div>
      <div style="background:#ff658420;border:2px solid #ff6584;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
        <p style="color:#ff6584;font-weight:700;margin:0 0 4px;font-size:18px;">⏰ ${expiresIn} Minutes Remaining</p>
        <p style="color:#aaa;margin:0 0 16px;font-size:13px;">This offer expires at ${expiresAt.toLocaleTimeString()}</p>
        <a href="${claimUrl}" style="display:inline-block;background:linear-gradient(135deg,#ff6584,#ffb347);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;">
          Claim Your Seat →
        </a>
      </div>
      <p style="color:#666;font-size:13px;">If you don't claim within ${expiresIn} minutes, the seat will be offered to the next person on the waitlist.</p>
    </div>
    <div style="background:#111;border-radius:0 0 16px 16px;padding:16px;text-align:center;border:1px solid #222;border-top:none;">
      <p style="color:#555;font-size:12px;margin:0;">TicketCollector Waitlist Notification</p>
    </div>
  </div>
</body>
</html>
  `;

  console.log(`✉️ Attempting to send waitlist email to: ${user.email} via Google Apps Script...`);
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: user.email,
        subject: `⚡ Seat Available — ${event.title} | Act fast!`,
        html
      })
    });
    
    if (!response.ok) {
      throw new Error(`Google Script returned ${response.status}`);
    }
    const result = (await response.json()) as any;
    if (result.error) {
      throw new Error(result.error);
    }
    console.log(`✅ Waitlist email sent to ${user.email}`);
  } catch (err: any) {
    console.error(`❌ Failed to send waitlist email to ${user.email}:`, err.message);
    throw err;
  }
}
