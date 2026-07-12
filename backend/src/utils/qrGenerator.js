const QRCode = require('qrcode');

const generateQR = async (data) => {
  try {
    const qrString = JSON.stringify(data);
    const qrDataURL = await QRCode.toDataURL(qrString, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    return qrDataURL;
  } catch (err) {
    console.error('QR generation error:', err.message);
    return null;
  }
};

module.exports = { generateQR };
