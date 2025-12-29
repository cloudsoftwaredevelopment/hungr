import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGO_PATH = '/var/www/html/websites/nfcrevolution/hungr/registration/uploads/logo.png';

/**
 * Generates an invoice PDF and returns it as a Buffer
 * @param {Object} data - Transaction data
 * @returns {Promise<Buffer>}
 */
export const generateInvoicePDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // Logo
            if (fs.existsSync(LOGO_PATH)) {
                doc.image(LOGO_PATH, 50, 45, { width: 100 });
            } else {
                doc.fontSize(25).text('HUNGR', 50, 45);
            }

            // Header Details
            doc.fillColor('#444444')
                .fontSize(20)
                .text('ELECTRONIC INVOICE', 50, 140)
                .fontSize(10)
                .text(`Invoice No: ${data.transactionId || 'N/A'}`, 200, 50, { align: 'right' })
                .text(`Date: ${new Date().toLocaleDateString()}`, 200, 65, { align: 'right' })
                .text(`Status: PAID`, 200, 80, { align: 'right' })
                .moveDown();

            // Company Info (Left Side)
            doc.fillColor('#000000')
                .fontSize(12)
                .font('Helvetica-Bold')
                .text('Hungr', 50, 180)
                .font('Helvetica')
                .fontSize(10)
                .text('Door 1 Rosalia building, Infante st.', 50, 195)
                .text('Molo Iloilo city 5000', 50, 210)
                .text('TAX ID: 010-952-897-000', 50, 225);

            // Bill To (Right Side)
            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Bill To:', 350, 180)
                .font('Helvetica')
                .fontSize(10)
                .text(data.userName || 'Valued Customer', 350, 195)
                .text(data.userEmail || '', 350, 210);

            // Table Header
            const tableTop = 280;
            doc.font('Helvetica-Bold');
            generateTableRow(doc, tableTop, 'Description', 'Qty', 'Unit Price', 'Amount');
            generateHr(doc, tableTop + 20);
            doc.font('Helvetica');

            // Table Content
            const description = data.description || 'Wallet Top-up';
            const amount = parseFloat(data.amount || 0).toFixed(2);
            generateTableRow(doc, tableTop + 30, description, '1', amount, amount);
            generateHr(doc, tableTop + 50);

            // Total section
            const totalTop = tableTop + 70;
            doc.font('Helvetica-Bold');
            doc.text('Total:', 350, totalTop);
            doc.text(`PHP ${amount}`, 450, totalTop, { align: 'right', width: 90 });

            // Footer
            const footerTop = 750;
            generateHr(doc, footerTop - 30);
            doc.fontSize(12)
                .font('Helvetica-Oblique')
                .text('Thank you for your business!', 50, footerTop, { align: 'center', width: 500 });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

function generateTableRow(doc, y, item, quantity, unitPrice, total) {
    doc.fontSize(10)
        .text(item, 50, y, { width: 230 })
        .text(quantity, 280, y, { width: 40, align: 'right' })
        .text(unitPrice, 350, y, { width: 90, align: 'right' })
        .text(total, 450, y, { width: 90, align: 'right' });
}

function generateHr(doc, y) {
    doc.strokeColor('#aaaaaa')
        .lineWidth(1)
        .moveTo(50, y)
        .lineTo(550, y)
        .stroke();
}

/**
 * Sends an email with an invoice attachment
 */
export const sendInvoiceEmail = async (userEmail, data, pdfBuffer) => {
    // Check if SMTP settings are available
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('⚠️ SMTP settings missing. Skipping email sent for invoice:', data.transactionId);
        return;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: (process.env.SMTP_PORT == 465),
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"Hungr Support" <admin@hungr.food>',
        to: userEmail,
        subject: `Electronic Invoice - ${data.description || 'Wallet Top-up'}`,
        text: `Hello ${data.userName},\n\nPlease find attached your electronic invoice for the ${data.description || 'wallet top-up'}.\n\nThank you for using Hungr!\n\nBest Regards,\nHungr Team`,
        attachments: [
            {
                filename: `Invoice_${data.transactionId || 'transaction'}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
            },
        ],
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Invoice email sent:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Error sending invoice email:', error);
        throw error;
    }
};
