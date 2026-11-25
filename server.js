const express = require('express');
const path = require('path');
const app = express();


app.use(express.json({ limit: '5mb' }));      // para entender los datos que manda la página
app.use(express.static(path.join(__dirname, 'obra_lista', 'public')));        // entrega tus 3 archivos

// Por ahora los datos viven en la memoria del servidor (después irán a una base de datos)
let datos = { proyectos: [], rubros: [], materiales: [], pagos: [] };

app.get('/api/datos', (req, res) => {         // la página pide los datos
  res.json(datos);
});

app.put('/api/datos', (req, res) => {         // la página manda los datos para guardarlos
  datos = req.body;
  res.json({ ok: true });
});

app.listen(3000, () => console.log('ObraLista lista en http://localhost:3000'));