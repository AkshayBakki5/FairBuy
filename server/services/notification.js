import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─── Price Change Alert ───────────────────────────────────────────────────────
export async function sendPriceAlert({ to, title, store, oldPrice, newPrice, url }) {
  const dropped       = newPrice < oldPrice;
  const direction     = dropped ? '📉 dropped' : '📈 increased';
  const difference    = Math.abs(oldPrice - newPrice).toFixed(0);
  const changePercent = ((Math.abs(oldPrice - newPrice) / oldPrice) * 100).toFixed(1);

  await transporter.sendMail({
    from:    `"Price Alert 🔔" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Price ${direction} for ${title} on ${store}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #eee;border-radius:10px;overflow:hidden;">
        <div style="background:#4f46e5;padding:20px;color:#fff;">
          <h2 style="margin:0;">🔔 Price Alert</h2>
        </div>
        <div style="padding:24px;">
          <p style="font-size:16px;"><strong>${title}</strong> on <strong>${store}</strong> has ${direction}!</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f5f5f5;">
              <td style="padding:10px;border:1px solid #ddd;">Old Price</td>
              <td style="padding:10px;border:1px solid #ddd;"><s>₹${oldPrice}</s></td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #ddd;">New Price</td>
              <td style="padding:10px;border:1px solid #ddd;color:${dropped ? 'green' : 'red'};font-weight:bold;">₹${newPrice}</td>
            </tr>
            <tr style="background:#f5f5f5;">
              <td style="padding:10px;border:1px solid #ddd;">Change</td>
              <td style="padding:10px;border:1px solid #ddd;">₹${difference} (${changePercent}%)</td>
            </tr>
          </table>
          <a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
            View Product →
          </a>
        </div>
        <div style="padding:12px 24px;background:#f9f9f9;font-size:12px;color:#999;">
          You are receiving this because you added this product to your watchlist.
        </div>
      </div>
    `,
  });
  console.log(`📧 Price alert sent to ${to} for "${title}"`);
}

// ─── Target Price Reached Alert ───────────────────────────────────────────────
export async function sendTargetPriceAlert({ to, title, store, targetPrice, currentPrice, url }) {
  await transporter.sendMail({
    from:    `"Price Alert 🔔" <${process.env.EMAIL_USER}>`,
    to,
    subject: `🎯 Target price reached for ${title}!`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;border:1px solid #eee;border-radius:10px;overflow:hidden;">
        <div style="background:#16a34a;padding:20px;color:#fff;">
          <h2 style="margin:0;">🎯 Target Price Reached!</h2>
        </div>
        <div style="padding:24px;">
          <p style="font-size:16px;"><strong>${title}</strong> on <strong>${store}</strong> has hit your target!</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f5f5f5;">
              <td style="padding:10px;border:1px solid #ddd;">Your Target</td>
              <td style="padding:10px;border:1px solid #ddd;font-weight:bold;">₹${targetPrice}</td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #ddd;">Current Price</td>
              <td style="padding:10px;border:1px solid #ddd;color:green;font-weight:bold;">₹${currentPrice}</td>
            </tr>
          </table>
          <a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
            Buy Now →
          </a>
        </div>
        <div style="padding:12px 24px;background:#f9f9f9;font-size:12px;color:#999;">
          You set a target price for this product in your watchlist.
        </div>
      </div>
    `,
  });
  console.log(`🎯 Target price alert sent to ${to} for "${title}"`);
}

// ─── 6-Hour Watchlist Digest ───────────────────────────────────────────────────
export async function sendWishlistDigest({ to, items }) {
  if (!items || items.length === 0) return;

  const timeStr = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const itemRows = items.map((item) => {
    const priceChange =
      item.lastPrice && item.price && item.price !== item.lastPrice
        ? item.price < item.lastPrice
          ? `<span style="color:green;">▼ ₹${(item.lastPrice - item.price).toFixed(0)} drop</span>`
          : `<span style="color:red;">▲ ₹${(item.price - item.lastPrice).toFixed(0)} rise</span>`
        : `<span style="color:#999;">No change</span>`;

    const targetBadge =
      item.targetPrice && item.price <= item.targetPrice
        ? `<span style="background:#16a34a;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;">🎯 Target Met!</span>`
        : item.targetPrice
        ? `<span style="color:#777;font-size:12px;">Target: ₹${item.targetPrice}</span>`
        : '';

    return `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:12px 8px;">
          ${item.imageUrl ? `<img src="${item.imageUrl}" style="width:50px;height:50px;object-fit:contain;border-radius:4px;" />` : ''}
        </td>
        <td style="padding:12px 8px;">
          <a href="${item.url}" style="color:#4f46e5;text-decoration:none;font-weight:600;font-size:14px;">${item.title}</a>
          <br/><span style="font-size:12px;color:#888;">${item.store || ''}</span>
          <br/>${targetBadge}
        </td>
        <td style="padding:12px 8px;text-align:right;white-space:nowrap;">
          <span style="font-size:18px;font-weight:bold;color:#4f46e5;">${item.price ? `₹${item.price}` : '—'}</span>
          <br/>${priceChange}
        </td>
      </tr>`;
  }).join('');

  await transporter.sendMail({
    from:    `"Watchlist Digest 📋" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Your Watchlist Update – ${timeStr}`,
    html: `
      <div style="font-family:sans-serif;max-width:640px;margin:auto;border:1px solid #eee;border-radius:10px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;color:#fff;">
          <h2 style="margin:0;">📋 Your Watchlist Digest</h2>
          <p style="margin:6px 0 0;opacity:0.85;font-size:14px;">Prices checked as of ${timeStr}</p>
        </div>
        <div style="padding:24px;">
          <p style="font-size:15px;margin-top:0;">
            Here's the latest update on your <strong>${items.length}</strong> watched item${items.length !== 1 ? 's' : ''}:
          </p>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f5f7ff;text-align:left;">
                <th style="padding:10px 8px;font-size:12px;color:#555;border-bottom:2px solid #e0e7ff;"></th>
                <th style="padding:10px 8px;font-size:12px;color:#555;border-bottom:2px solid #e0e7ff;">Product</th>
                <th style="padding:10px 8px;font-size:12px;color:#555;border-bottom:2px solid #e0e7ff;text-align:right;">Price</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div style="margin-top:20px;text-align:center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/watchlist"
               style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;">
              View Full Watchlist →
            </a>
          </div>
        </div>
        <div style="padding:12px 24px;background:#f9f9f9;font-size:12px;color:#999;text-align:center;">
          Digest emails are sent every 6 hours for your tracked products.
        </div>
      </div>
    `,
  });
  console.log(`📋 Digest sent to ${to} (${items.length} items)`);
}
