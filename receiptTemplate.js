function generateReceipt(title, items, total, meta = {}) {
  const rows = items
    .map(
      (it) =>
        `<tr><td style="width:50%">${
          it.name
        }</td><td style="width:25%;text-align:center">${
          it.qty
        }</td><td style="width:25%;text-align:right">${(
          it.qty * it.price
        ).toLocaleString("id-ID")}</td></tr>`
    )
    .join("");

  const businessName = meta.businessName || "";
  const businessAddr = meta.address || "";
  const website = meta.website || meta?.contact?.website || "";
  const whatsapp = meta.whatsapp || meta?.contact?.whatsapp || "";
  const instagram = meta.instagram || meta?.contact?.instagram || "";
  const orderId = meta.orderId || "";
  const dateStr = meta.date || new Date().toLocaleString("id-ID");
  const buyerName = meta?.buyer?.name || "";
  const buyerPhone = meta?.buyer?.phone || "";
  const recipientName = meta?.recipient?.name || "";
  const deliveryType = meta?.delivery?.type || ""; // delivery|pickup
  const deliveryAddress = meta?.delivery?.address || "";
  const deliveryDt = meta?.delivery?.datetime
    ? new Date(meta.delivery.datetime).toLocaleString("id-ID")
    : "";
  const paymentMethod = meta?.paymentMethod
    ? String(meta.paymentMethod).toUpperCase()
    : "";
  const customerNotes = meta?.customerNotes || meta?.notes || "";
  const servedByFlorist = meta?.servedByFlorist || meta?.floristNumber || null;

  return `
      <html>
        <head>
          <style>
            @page { 
              size: 58mm auto; 
              margin: 2mm; 
            }
            body { 
              width: 54mm; 
              font-family: monospace; 
              font-size: 11px; 
              margin: 0; 
              padding: 0;
              line-height: 1.2;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
            }
            td { 
              padding: 1px 0; 
              vertical-align: top;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            hr { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
            .hint { margin-top: 2mm; font-size: 10px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="center bold">${businessName || title}</div>
          ${businessAddr ? `<div class="center">${businessAddr}</div>` : ""}
          <div class="center">================================</div>
          <div style="font-size:10px;">
            ${orderId ? `ID: ${String(orderId).padStart(6, "0")}<br/>` : ""}
            ${dateStr}<br/>
            ${buyerName ? `Pembeli : ${buyerName}<br/>` : ""}
            ${buyerPhone ? `Telepon : ${buyerPhone}<br/>` : ""}
            ${recipientName ? `Penerima: ${recipientName}<br/>` : ""}
            ${servedByFlorist ? `Florist : ${servedByFlorist}<br/>` : ""}
            ${
              deliveryType
                ? `Tipe    : ${
                    deliveryType === "pickup"
                      ? "Ambil di tempat"
                      : "Antar ke alamat"
                  }<br/>`
                : ""
            }
            ${deliveryDt ? `Antar   : ${deliveryDt}<br/>` : ""}
            ${deliveryAddress ? `Alamat  : ${deliveryAddress}<br/>` : ""}
            ${paymentMethod ? `Bayar   : ${paymentMethod}<br/>` : ""}
          </div>
          <div class="center">================================</div>
          <table>
            <tr><td><strong>Item</strong></td><td class="center"><strong>Qty</strong></td><td class="right"><strong>Harga</strong></td></tr>
            ${rows}
          </table>
          <hr/>
          <div class="right bold">TOTAL: Rp ${total.toLocaleString(
            "id-ID"
          )}</div>
          ${
            customerNotes
              ? `<div class="center" style="margin-top:2mm; font-size:10px;">${customerNotes}</div>`
              : ""
          }
          <div class="hint">Bawa ini ke kasir untuk pembayaran</div>
          <div class="center">================================</div>
          ${
            website || whatsapp || instagram
              ? `<div class="center" style="font-size:10px; line-height:1.3;">
                  ${website ? `Web: ${website}<br/>` : ""}
                  ${whatsapp ? `WA: ${whatsapp}<br/>` : ""}
                  ${instagram ? `IG: ${instagram}` : ""}
                </div>`
              : ""
          }
          <div class="center">Terima kasih atas kunjungan Anda</div>
          <div class="center">🙏</div>
          <br/>
        </body>
      </html>`;
}

module.exports = { generateReceipt };
