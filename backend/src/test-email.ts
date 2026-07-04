import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

console.log('Using Gmail User:', process.env.GMAIL_USER);
console.log('Using App Password Length:', process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.length : 0);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function run() {
  console.log('Verifying transporter...');
  try {
    await new Promise((resolve, reject) => {
      transporter.verify((error, success) => {
        if (error) reject(error);
        else resolve(success);
      });
    });
    console.log('✅ Transporter is ready to send emails!');

    console.log('Sending test email...');
    const info = await transporter.sendMail({
      from: `"Test Mailer" <${process.env.GMAIL_USER}>`,
      to: 'anshsoni.in@gmail.com',
      subject: 'Test Email from TicketCollector',
      text: 'If you receive this, your email configuration is working perfectly!',
    });
    console.log('✅ Email sent successfully! Message ID:', info.messageId);
  } catch (err: any) {
    console.error('❌ Error occurred:', err.message);
    if (err.stack) console.error(err.stack);
  }
}

run();
