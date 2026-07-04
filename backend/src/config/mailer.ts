import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

transporter.verify((error) => {
  if (error) {
    console.warn('⚠️  Mailer not connected:', error.message);
  } else {
    console.log('✅ Mailer ready');
  }
});

export default transporter;
