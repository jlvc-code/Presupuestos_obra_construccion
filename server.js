const PDFDocument = require('pdfkit');
const express = require('express');
const path = require('path');
const app = express();


app.use(express.json({ limit: '5mb' }));      // para entender los datos que manda la página
app.use(express.static(path.join(__dirname, 'obra_lista', 'public')));        // entrega tus 3 archivos

// Por ahora los datos viven en la memoria del servidor (después irán a una base de datos)
let datos = { proyectos: [], rubros: [], materiales: [], pagos: [] };

app.get('/api/datos', (_req, res) => {         // la página pide los datos
  res.json(datos);
});

app.put('/api/datos', (req, res) => {         // la página manda los datos para guardarlos
  datos = req.body;
  res.json({ ok: true });
});

app.post('/api/pdf', (req, res) => {
  try {
    const { tipo, proyecto, items, empresa, totales } = req.body;
    if (!proyecto) return res.status(400).send('Faltan datos del proyecto');

    const doc = new PDFDocument({ margin: 45, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${tipo}_${proyecto.obra}.pdf"`);
    doc.pipe(res);

    // 1. Logo de la constructora
    let textoX = 45;
    if (empresa && empresa.logo && empresa.logo.startsWith('data:image')) {
      try {
        const base64Data = empresa.logo.slice(empresa.logo.indexOf(',') + 1);
        const imgBuffer = Buffer.from(base64Data, 'base64');
        doc.image(imgBuffer, 45, 40, { width: 105, height: 60 });
        textoX = 165;
      } catch (e) {
        console.error('Error leyendo logo:', e);
      }
    }

    // 2. Encabezado de la empresa
    doc.fillColor('#111827').fontSize(15).font('Helvetica-Bold')
       .text((empresa?.nombre || 'PRESUPUESTO DE CONSTRUCCIÓN').toUpperCase(), textoX, 42, { width: 225 });
    doc.fillColor('#4b5563').fontSize(9).font('Helvetica');
    let yEmpresa = doc.y + 2;
    if (empresa?.ruc) { doc.text(`RUC / ID: ${empresa.ruc}`, textoX, yEmpresa); yEmpresa += 13; }
    const contacto = [empresa?.ciudad, empresa?.telefono ? `Tel: ${empresa.telefono}` : ''].filter(Boolean).join(' • ');
    if (contacto) doc.text(contacto, textoX, yEmpresa);

    const titulos = {
      presupuesto: 'PROFORMA / PRESUPUESTO',
      materiales: 'LISTA DE MATERIALES',
      pagos: 'ESTADO DE CUENTA'
    };
    doc.rect(395, 42, 155, 22).fill('#15752c');
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
       .text(titulos[tipo] || 'DOCUMENTO', 395, 49, { width: 155, align: 'center' });
    doc.fillColor('#374151').fontSize(9).font('Helvetica')
       .text(`Fecha: ${new Date().toISOString().slice(0, 10)}`, 395, 70, { width: 155, align: 'right' })
       .text(`Obra N.º: ${String(proyecto.id).slice(-6)}`, 395, 83, { width: 155, align: 'right' });

    doc.moveTo(45, 110).lineTo(550, 110).lineWidth(2).stroke('#15752c');

    // 3. Caja de datos del cliente y la obra
    doc.rect(45, 122, 505, 52).fill('#f8fafc');
    doc.fillColor('#1f2937').fontSize(10);
    doc.font('Helvetica-Bold').text('Cliente: ', 55, 132, { continued: true }).font('Helvetica').text(proyecto.cliente);
    doc.font('Helvetica-Bold').text('Teléfono: ', 55, 148, { continued: true }).font('Helvetica').text(proyecto.telefono || '—');
    doc.font('Helvetica-Bold').text('Obra: ', 300, 132, { continued: true }).font('Helvetica').text(proyecto.obra);
    doc.font('Helvetica-Bold').text('Ubicación: ', 300, 148, { continued: true }).font('Helvetica').text(proyecto.ubicacion || '—');

    // 4. Tabla de ítems
    let y = 192;
    doc.rect(45, y, 505, 24).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');

    if (tipo === 'presupuesto') {
      doc.text('DESCRIPCIÓN DEL RUBRO', 55, y + 8);
      doc.text('CANT.', 310, y + 8, { width: 55, align: 'right' });
      doc.text('V. UNIT.', 375, y + 8, { width: 75, align: 'right' });
      doc.text('SUBTOTAL', 460, y + 8, { width: 80, align: 'right' });
    } else if (tipo === 'materiales') {
      doc.text('MATERIAL', 55, y + 8);
      doc.text('CANTIDAD', 340, y + 8, { width: 80, align: 'right' });
      doc.text('UNIDAD', 435, y + 8, { width: 105 });
    } else if (tipo === 'pagos') {
      doc.text('FECHA', 55, y + 8);
      doc.text('CONCEPTO', 170, y + 8);
      doc.text('MONTO ABONADO', 420, y + 8, { width: 120, align: 'right' });
    }

    y += 24;
    doc.font('Helvetica').fontSize(10);

    (items || []).forEach((item, idx) => {
      if (y > 720) { doc.addPage(); y = 50; }
      if (idx % 2 === 1) doc.rect(45, y, 505, 22).fill('#f9fafb');
      doc.fillColor('#1f2937');

      if (tipo === 'presupuesto') {
        doc.text(item.nombre, 55, y + 6, { width: 250 });
        doc.text(String(item.cantidad), 310, y + 6, { width: 55, align: 'right' });
        doc.text(`$${Number(item.valor).toFixed(2)}`, 375, y + 6, { width: 75, align: 'right' });
        doc.font('Helvetica-Bold').text(`$${(item.cantidad * item.valor).toFixed(2)}`, 460, y + 6, { width: 80, align: 'right' }).font('Helvetica');
      } else if (tipo === 'materiales') {
        doc.text(item.nombre, 55, y + 6, { width: 280 });
        doc.font('Helvetica-Bold').text(String(item.cantidad), 340, y + 6, { width: 80, align: 'right' }).font('Helvetica');
        doc.text(item.unidad || 'unidad', 435, y + 6, { width: 105 });
      } else if (tipo === 'pagos') {
        doc.text(item.fecha, 55, y + 6);
        doc.text(`Abono #${idx + 1}`, 170, y + 6);
        doc.font('Helvetica-Bold').text(`$${Number(item.monto).toFixed(2)}`, 420, y + 6, { width: 120, align: 'right' }).font('Helvetica');
      }

      doc.moveTo(45, y + 22).lineTo(550, y + 22).lineWidth(0.5).stroke('#e5e7eb');
      y += 22;
    });

    // 5. Totales
    y += 15;
    if (tipo === 'presupuesto') {
      doc.rect(340, y, 210, 28).fill('#f0fdf4').stroke('#bbf7d0');
      doc.fillColor('#14532d').fontSize(11).font('Helvetica-Bold')
         .text('TOTAL:', 352, y + 9)
         .text(`$${Number(totales?.total || 0).toFixed(2)}`, 420, y + 9, { width: 120, align: 'right' });
      y += 45;
    } else if (tipo === 'pagos') {
      const filas = [
        { label: 'Total Presupuesto:', val: totales?.total || 0, bg: '#f8fafc', fg: '#1e293b' },
        { label: 'Total Cobrado:', val: totales?.cobrado || 0, bg: '#f0fdf4', fg: '#14532d' },
        { label: 'Saldo Pendiente:', val: Math.max(0, totales?.saldo || 0), bg: '#fef2f2', fg: '#991b1b' }
      ];
      for (const f of filas) {
        doc.rect(320, y, 230, 24).fill(f.bg);
        doc.fillColor(f.fg).fontSize(10).font('Helvetica-Bold')
           .text(f.label, 330, y + 7)
           .text(`$${Number(f.val).toFixed(2)}`, 430, y + 7, { width: 110, align: 'right' });
        y += 28;
      }
      y += 15;
    }

    // 6. Firmas al pie (con imagen de firma autorizada si existe)
    if (y > 670) { doc.addPage(); y = 60; }
    y += 50;

    if (empresa && empresa.firma && empresa.firma.startsWith('data:image')) {
      try {
        const firmaBase64 = empresa.firma.slice(empresa.firma.indexOf(',') + 1);
        const firmaBuffer = Buffer.from(firmaBase64, 'base64');
        doc.image(firmaBuffer, 115, y - 45, { width: 100, height: 42 });
      } catch (e) {
        console.error('Error leyendo firma:', e);
      }
    }

    doc.fillColor('#374151').fontSize(9).font('Helvetica');
    doc.text('______________________________', 75, y, { width: 180, align: 'center' });
    doc.text('Firma Autorizada', 75, y + 14, { width: 180, align: 'center' });
    doc.text('______________________________', 340, y, { width: 180, align: 'center' });
    doc.text('Aceptación del Cliente', 340, y + 14, { width: 180, align: 'center' });

    doc.end();
  } catch (err) {
    console.error('Error general en /api/pdf:', err);
    if (!res.headersSent) res.status(500).send('Error interno generando PDF');
  }
});


app.listen(3000, () => console.log('ObraLista lista en http://localhost:3000'));