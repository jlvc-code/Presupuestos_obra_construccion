const proyectos = [];
const rubros = [];
const materiales = [];   // NUEVO: materiales de todos los presupuestos
const pagos = [];        // NUEVO: cobros y pagos de todos los presupuestos
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let ultimoId = 0;
const nuevoId = () => { ultimoId = Math.max(Date.now(), ultimoId + 1); return ultimoId; };   // NUEVO: id que nunca se repite

function dibujarLista() {
  const lista = document.querySelector('#lista');
  const texto = document.querySelector('#buscar').value.toLowerCase();
  const visibles = proyectos.filter(p => (p.cliente + ' ' + p.obra + ' ' + p.inicio).toLowerCase().includes(texto)).sort((a, b) => b.id - a.id);   // NUEVO: los más nuevos arriba
  lista.innerHTML = '';
  document.querySelector('#vacio').hidden = proyectos.length > 0;
  for (const p of visibles) {
    const total = totalDe(p.id);
    const saldo = total - cobradoDe(p.id);
    lista.innerHTML += `<a class="card" href="#detalle" data-id="${p.id}">
      <b>${esc(p.obra)}</b>
      <div class="mut">${esc(p.cliente)} · ${esc(p.inicio) || 'sin fecha'}</div>
      <div class="row"><span>Total $${total}</span><span class="${saldo > 0 ? 'bad' : ''}">Saldo $${saldo}</span></div>
    </a>`;
  }
}
document.querySelector('#buscar').addEventListener('input', dibujarLista);

let editandoPresupuesto = null;   // NUEVO: id del presupuesto que se está editando (null = es uno nuevo)

document.querySelector('#btn-guardar').addEventListener('click', guardarPresupuesto);

// NUEVO: deja el formulario listo, vacío (nuevo) o con los datos de un presupuesto (editar)
function prepararFormPresupuesto(id) {
  editandoPresupuesto = id;
  const p = id === null ? null : proyectos.find(x => x.id === id);
  document.querySelector('#form-titulo').textContent = p ? 'Editar presupuesto' : 'Nuevo presupuesto';
  document.querySelector('#cliente').value = p ? p.cliente : '';
  document.querySelector('#telefono').value = p ? p.telefono : '';
  document.querySelector('#obra').value = p ? p.obra : '';
  document.querySelector('#ubicacion').value = p ? p.ubicacion : '';
  document.querySelector('#inicio-fecha').value = p ? p.inicio : '';
  document.querySelector('#entrega-fecha').value = p ? p.entrega : '';
  document.querySelector('#msg-form').textContent = '';
}
document.querySelector('#btn-nuevo').addEventListener('click', () => prepararFormPresupuesto(null));
document.querySelector('#btn-editar').addEventListener('click', () => prepararFormPresupuesto(actualId));
document.querySelector('#btn-cancelar-presupuesto').addEventListener('click', e => {
  e.preventDefault();
  location.hash = editandoPresupuesto === null ? '#inicio' : '#detalle';   // si estabas editando, vuelves al detalle
});

function guardarPresupuesto() {
  const cliente = document.querySelector('#cliente').value.trim();
  const obra = document.querySelector('#obra').value.trim();
  const mensaje = document.querySelector('#msg-form');

  if (cliente === '' || obra === '') {
    mensaje.textContent = 'Falta el cliente o la obra.';
    return;
  }

  const datos = {
    cliente: cliente,
    telefono: document.querySelector('#telefono').value.trim(),
    obra: obra,
    ubicacion: document.querySelector('#ubicacion').value.trim(),
    inicio: document.querySelector('#inicio-fecha').value,
    entrega: document.querySelector('#entrega-fecha').value
  };

  if (editandoPresupuesto === null) {
    proyectos.push({ id: nuevoId(), ...datos });                 // uno nuevo
    location.hash = '#inicio';
  } else {
    Object.assign(proyectos.find(x => x.id === editandoPresupuesto), datos);   // NUEVO: cambia el que ya existe
    location.hash = '#detalle';
  }

  prepararFormPresupuesto(null);
  dibujarLista();
  guardarEnServidor();                         // NUEVO: manda los datos al servidor
  if (actualId !== null) dibujarDetalle();                        // refresca el encabezado del detalle
}

let actualId = null;
let editandoRubro = null;   // NUEVO: id del rubro que se está editando (null = ninguno)
let editandoMaterial = null; // NUEVO: lo mismo, pero para materiales
let editandoPago = null;     // NUEVO: lo mismo, pero para pagos

// NUEVO: aviso flotante que se puede usar para cualquier borrado
const aviso = document.querySelector('#confirmar');
let alConfirmar = null;
function confirmar(texto, accion, textoSi = 'Sí, borrar') {   // CAMBIO: el botón de «sí» puede decir otra cosa
  document.querySelector('#confirmar-texto').textContent = texto;
  document.querySelector('#confirmar-si').textContent = textoSi;
  alConfirmar = accion;
  aviso.showModal();
}
document.querySelector('#confirmar-no').addEventListener('click', () => aviso.close());
document.querySelector('#confirmar-si').addEventListener('click', () => {
  aviso.close();
  if (alConfirmar) alConfirmar();
  alConfirmar = null;
});
const dinero = n => '$' + Number(n).toFixed(2);
const totalDe = id => rubros.filter(r => r.p === id).reduce((suma, r) => suma + r.cantidad * r.valor, 0);
const sumaTipo = (lista, tipo) => lista.filter(x => x.tipo === tipo).reduce((suma, x) => suma + x.monto, 0);   // NUEVO
const cobradoDe = id => sumaTipo(pagos.filter(x => x.p === id), 'cobro');         // lo que el cliente ya te dio
const pagadoDe = id => sumaTipo(pagos.filter(x => x.p === id), 'trabajador');     // NUEVO: lo que ya pagaste a trabajadores
// NUEVO: 0 = todo bien, 1 = pagaste más de lo cobrado, 2 = pagaste más de lo que vale todo el presupuesto
const nivelAviso = (total, cobrado, pagado) => (total > 0 && pagado > total) ? 2 : (pagado > cobrado ? 1 : 0);
const hoy = () => {                          // NUEVO: fecha de hoy según tu hora (AAAA-MM-DD)
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

document.querySelector('#lista').addEventListener('click', e => {
  const tarjeta = e.target.closest('.card');
  if (!tarjeta) return;
  actualId = Number(tarjeta.dataset.id);
  limpiarFormRubro();                          // NUEVO
  limpiarFormMaterial();                       // NUEVO
  limpiarFormPago();                           // NUEVO
  mostrarPestana('rubros');                    // NUEVO: siempre empieza en Rubros
  dibujarDetalle();
});

function dibujarDetalle() {
  const p = proyectos.find(x => x.id === actualId);
  const total = totalDe(p.id);                 // CORREGIDO: faltaba crear total
  const cobrado = cobradoDe(p.id);             // CAMBIO: sale de los pagos
  const saldo = total - cobrado;
  document.querySelector('#det-obra').textContent = p.obra;
  // CORREGIDO: con textContent no se usa esc()
  document.querySelector('#det-info').textContent = `${p.cliente} ${p.telefono || ''} · ${p.ubicacion || 'sin ubicación'} · Inicio ${p.inicio || '—'} · Entrega ${p.entrega || '—'}`;
  document.querySelector('#det-total').textContent = dinero(total);
  document.querySelector('#det-cobrado').textContent = dinero(cobrado);
  document.querySelector('#det-saldo').textContent = dinero(saldo);
  document.querySelector('#det-saldo').classList.toggle('bad', saldo > 0);
  const pagado = pagadoDe(p.id);                // NUEVO
  const queda = cobrado - pagado;
  document.querySelector('#det-pagado').textContent = dinero(pagado);
  document.querySelector('#det-queda-etiqueta').textContent = queda >= 0 ? 'Te queda del cobro' : 'Pusiste de tu bolsillo';
  document.querySelector('#det-queda').textContent = dinero(Math.abs(queda));
  document.querySelector('#det-queda').classList.toggle('bad', queda < 0);
  mostrarAviso(total, cobrado, pagado);
  dibujarRubros();                             // CORREGIDO: faltaba dibujar los rubros
  dibujarMateriales();                         // NUEVO
  dibujarPagos();                              // NUEVO
}

function dibujarRubros() {
  const caja = document.querySelector('#lista-rubros');
  caja.innerHTML = '';
  for (const r of rubros.filter(x => x.p === actualId)) {
    caja.innerHTML += `<div class="card row">
      <span>${esc(r.nombre)}<br><small class="mut">${r.cantidad} × ${dinero(r.valor)}</small></span>
      <span><b>${dinero(r.cantidad * r.valor)}</b> <button class="ed" type="button" data-id="${r.id}" aria-label="Editar">✎</button><button class="x" type="button" data-id="${r.id}" aria-label="Borrar">✕</button></span>
    </div>`;
  }
}

document.querySelector('#btn-agregar-rubro').addEventListener('click', () => {
  const nombre = document.querySelector('#rubro-nombre').value.trim();
  const cantidad = parseFloat(document.querySelector('#rubro-cantidad').value);
  const valor = parseFloat(document.querySelector('#rubro-valor').value);
  if (nombre === '' || isNaN(cantidad) || isNaN(valor)) return;
  if (editandoRubro === null) {
    rubros.push({ id: nuevoId(), p: actualId, nombre, cantidad, valor });   // agregar uno nuevo
  } else {
    const r = rubros.find(x => x.id === editandoRubro);                      // NUEVO: cambiar el que ya existe
    Object.assign(r, { nombre, cantidad, valor });
  }
  limpiarFormRubro();
  dibujarDetalle();
  dibujarLista();
  guardarEnServidor();
});

// NUEVO: deja el formulario de rubros como al inicio
function limpiarFormRubro() {
  editandoRubro = null;
  document.querySelector('#rubro-nombre').value = '';
  document.querySelector('#rubro-cantidad').value = '';
  document.querySelector('#rubro-valor').value = '';
  document.querySelector('#btn-agregar-rubro').textContent = 'Agregar';
  document.querySelector('#btn-cancelar-rubro').hidden = true;
}
document.querySelector('#btn-cancelar-rubro').addEventListener('click', limpiarFormRubro);

document.querySelector('#lista-rubros').addEventListener('click', e => {
  const borrar = e.target.closest('.x');
  const editar = e.target.closest('.ed');

  if (editar) {                                // NUEVO: pasar el rubro al formulario
    const r = rubros.find(x => x.id === Number(editar.dataset.id));
    editandoRubro = r.id;
    document.querySelector('#rubro-nombre').value = r.nombre;
    document.querySelector('#rubro-cantidad').value = r.cantidad;
    document.querySelector('#rubro-valor').value = r.valor;
    document.querySelector('#btn-agregar-rubro').textContent = 'Guardar cambios';
    document.querySelector('#btn-cancelar-rubro').hidden = false;
    document.querySelector('#rubro-nombre').focus();
  }

  if (borrar) {
    const id = Number(borrar.dataset.id);
    const r = rubros.find(x => x.id === id);
    confirmar(`¿Borrar el rubro «${r.nombre}»?`, () => {     // NUEVO: primero pregunta
      if (id === editandoRubro) limpiarFormRubro();
      rubros.splice(rubros.findIndex(x => x.id === id), 1);
      dibujarDetalle();
      dibujarLista();
      guardarEnServidor();
    });
  }
});


// ===== PESTAÑAS (Rubros / Materiales / Pagos) =====
function mostrarPestana(nombre) {
  for (const b of document.querySelectorAll('[data-tab]')) {
    b.classList.toggle('p', b.dataset.tab === nombre);
    document.querySelector('#panel-' + b.dataset.tab).hidden = b.dataset.tab !== nombre;
  }
}
document.querySelector('.tabs').addEventListener('click', e => {
  const boton = e.target.closest('[data-tab]');
  if (boton) mostrarPestana(boton.dataset.tab);
});

// ===== MATERIALES (mismo molde que los rubros) =====
function dibujarMateriales() {
  const caja = document.querySelector('#lista-materiales');
  caja.innerHTML = '';
  for (const m of materiales.filter(x => x.p === actualId)) {
    caja.innerHTML += `<div class="card row">
      <span>${esc(m.nombre)}</span>
      <span>${m.cantidad} ${esc(m.unidad)} <button class="ed" type="button" data-id="${m.id}" aria-label="Editar">✎</button><button class="x" type="button" data-id="${m.id}" aria-label="Borrar">✕</button></span>
    </div>`;
  }
}

document.querySelector('#btn-agregar-material').addEventListener('click', () => {
  const nombre = document.querySelector('#material-nombre').value.trim();
  const cantidad = parseFloat(document.querySelector('#material-cantidad').value);
  const unidad = document.querySelector('#material-unidad').value.trim();
  if (nombre === '' || isNaN(cantidad)) return;
  if (editandoMaterial === null) {
    materiales.push({ id: nuevoId(), p: actualId, nombre, cantidad, unidad });
  } else {
    const m = materiales.find(x => x.id === editandoMaterial);
    Object.assign(m, { nombre, cantidad, unidad });
  }
  limpiarFormMaterial();
  dibujarMateriales();
  guardarEnServidor();
});

function limpiarFormMaterial() {
  editandoMaterial = null;
  document.querySelector('#material-nombre').value = '';
  document.querySelector('#material-cantidad').value = '';
  document.querySelector('#material-unidad').value = '';
  document.querySelector('#btn-agregar-material').textContent = 'Agregar';
  document.querySelector('#btn-cancelar-material').hidden = true;
}
document.querySelector('#btn-cancelar-material').addEventListener('click', limpiarFormMaterial);

document.querySelector('#lista-materiales').addEventListener('click', e => {
  const borrar = e.target.closest('.x');
  const editar = e.target.closest('.ed');

  if (editar) {
    const m = materiales.find(x => x.id === Number(editar.dataset.id));
    editandoMaterial = m.id;
    document.querySelector('#material-nombre').value = m.nombre;
    document.querySelector('#material-cantidad').value = m.cantidad;
    document.querySelector('#material-unidad').value = m.unidad;
    document.querySelector('#btn-agregar-material').textContent = 'Guardar cambios';
    document.querySelector('#btn-cancelar-material').hidden = false;
    document.querySelector('#material-nombre').focus();
  }

  if (borrar) {
    const id = Number(borrar.dataset.id);
    const m = materiales.find(x => x.id === id);
    confirmar(`¿Borrar el material «${m.nombre}»?`, () => {
      if (id === editandoMaterial) limpiarFormMaterial();
      materiales.splice(materiales.findIndex(x => x.id === id), 1);
      dibujarMateriales();
      guardarEnServidor();
    });
  }
});

// ===== PAGOS: dos columnas, totales y avisos que NO bloquean =====
function mostrarAviso(total, cobrado, pagado) {
  const cartel = document.querySelector('#det-aviso');
  const nivel = nivelAviso(total, cobrado, pagado);
  cartel.hidden = nivel === 0;
  cartel.className = 'aviso ' + (nivel === 2 ? 'aviso-rojo' : 'aviso-amarillo');
  if (nivel === 1) cartel.textContent = `Pagaste ${dinero(pagado - cobrado)} más de lo que te han cobrado. Esa plata la pusiste tú y la recuperas cuando el cliente pague.`;
  if (nivel === 2) cartel.textContent = `Ya pagaste ${dinero(pagado - total)} más de lo que vale todo el presupuesto (${dinero(total)}). El cliente no te lo cubre aunque pague todo: es pérdida.`;
}

function filaPago(g) {
  return `<div class="card mini">
    <small class="mut">${esc(g.fecha)}</small>
    <b>${dinero(g.monto)}</b>
    <div class="acc"><button class="ed" type="button" data-id="${g.id}" aria-label="Editar">✎</button><button class="x" type="button" data-id="${g.id}" aria-label="Borrar">✕</button></div>
  </div>`;
}

function dibujarPagos() {
  const deEste = pagos.filter(x => x.p === actualId).sort((a, b) => a.fecha < b.fecha ? 1 : -1);   // el más reciente arriba
  const cobros = deEste.filter(x => x.tipo === 'cobro');
  const trabajadores = deEste.filter(x => x.tipo === 'trabajador');
  document.querySelector('#lista-cobros').innerHTML = cobros.map(filaPago).join('');
  document.querySelector('#lista-trabajadores').innerHTML = trabajadores.map(filaPago).join('');
  document.querySelector('#total-cobros').textContent = dinero(sumaTipo(cobros, 'cobro'));
  document.querySelector('#total-trabajadores').textContent = dinero(sumaTipo(trabajadores, 'trabajador'));
}

document.querySelector('#btn-agregar-pago').addEventListener('click', () => {
  const fecha = document.querySelector('#pago-fecha').value;
  const monto = parseFloat(document.querySelector('#pago-monto').value);
  const tipo = document.querySelector('#pago-tipo').value;
  if (fecha === '' || isNaN(monto)) return;

  const guardar = () => {
    if (editandoPago === null) {
      pagos.push({ id: nuevoId(), p: actualId, fecha, monto, tipo });
    } else {
      Object.assign(pagos.find(x => x.id === editandoPago), { fecha, monto, tipo });
    }
    limpiarFormPago();
    dibujarDetalle();
    dibujarLista();
    guardarEnServidor();
  };

  // NUEVO: ¿cómo quedarían las cuentas si se guarda? Si empeoran, se pregunta, pero se deja guardar.
  const quedaria = [...pagos.filter(x => x.p === actualId && x.id !== editandoPago), { tipo, monto }];
  const total = totalDe(actualId);
  const cobrado = sumaTipo(quedaria, 'cobro');
  const pagado = sumaTipo(quedaria, 'trabajador');
  const antes = nivelAviso(total, cobradoDe(actualId), pagadoDe(actualId));
  const despues = nivelAviso(total, cobrado, pagado);

  if (despues > antes) {
    const texto = despues === 2
      ? `Con este cambio habrás pagado ${dinero(pagado - total)} más de lo que vale todo el presupuesto. ¿Guardar igual?`
      : `Con este cambio habrás pagado ${dinero(pagado - cobrado)} más de lo que te han cobrado. ¿Guardar igual?`;
    confirmar(texto, guardar, 'Sí, guardar');
  } else {
    guardar();
  }
});

function limpiarFormPago() {
  editandoPago = null;
  document.querySelector('#pago-fecha').value = hoy();
  document.querySelector('#pago-monto').value = '';
  document.querySelector('#pago-tipo').value = 'cobro';
  document.querySelector('#btn-agregar-pago').textContent = 'Agregar';
  document.querySelector('#btn-cancelar-pago').hidden = true;
}
document.querySelector('#btn-cancelar-pago').addEventListener('click', limpiarFormPago);

// un solo oyente para las dos columnas
document.querySelector('#panel-pagos').addEventListener('click', e => {
  const borrar = e.target.closest('.x');
  const editar = e.target.closest('.ed');

  if (editar) {
    const g = pagos.find(x => x.id === Number(editar.dataset.id));
    editandoPago = g.id;
    document.querySelector('#pago-fecha').value = g.fecha;
    document.querySelector('#pago-monto').value = g.monto;
    document.querySelector('#pago-tipo').value = g.tipo;
    document.querySelector('#btn-agregar-pago').textContent = 'Guardar cambios';
    document.querySelector('#btn-cancelar-pago').hidden = false;
    document.querySelector('#pago-monto').focus();
  }

  if (borrar) {
    const id = Number(borrar.dataset.id);
    const g = pagos.find(x => x.id === id);
    confirmar(`¿Borrar el pago de ${dinero(g.monto)} del ${g.fecha}?`, () => {
      if (id === editandoPago) limpiarFormPago();
      pagos.splice(pagos.findIndex(x => x.id === id), 1);
      dibujarDetalle();
      dibujarLista();
      guardarEnServidor();
    });
  }
});

limpiarFormPago();   // deja la fecha de hoy puesta desde el inicio
// ===== ELIMINAR UN PRESUPUESTO (borra también todo lo que tiene adentro) =====
const quitarDe = (lista, id) => {              // saca de la lista todo lo que pertenece al presupuesto
  for (let i = lista.length - 1; i >= 0; i--) {
    if (lista[i].p === id) lista.splice(i, 1);
  }
};

document.querySelector('#btn-eliminar').addEventListener('click', () => {
  if (actualId === null) return;
  const id = actualId;
  const p = proyectos.find(x => x.id === id);
  const nR = rubros.filter(x => x.p === id).length;
  const nM = materiales.filter(x => x.p === id).length;
  const nP = pagos.filter(x => x.p === id).length;

  confirmar(`¿Eliminar el presupuesto «${p.obra}»? Se borrará todo lo que tiene: rubros (${nR}), materiales (${nM}) y pagos (${nP}). No se puede deshacer.`, () => {
    proyectos.splice(proyectos.findIndex(x => x.id === id), 1);
    quitarDe(rubros, id);
    quitarDe(materiales, id);
    quitarDe(pagos, id);
    actualId = null;
    dibujarLista();
    guardarEnServidor();
    location.hash = '#inicio';
  }, 'Sí, eliminar');
});

// ===== WHATSAPP: tres envíos separados =====
// Regla: el presupuesto, la lista de materiales y los cobros NUNCA van mezclados.
// Y lo que le pagaste a tus trabajadores no se envía jamás: ni siquiera existe aquí.
function enlaceWhatsApp(p, lineas) {
  let numero = (p.telefono || '').replace(/\D/g, '');            // deja solo los números
  if (numero.startsWith('0')) numero = '593' + numero.slice(1);   // 0990000000 -> 593990000000 (Ecuador)
  return `https://wa.me/${numero}?text=${encodeURIComponent(lineas.join('\n'))}`;
}

function ponerEnlace(id, url) {                  // si no hay nada que enviar, el botón queda apagado
  const a = document.querySelector(id);
  if (url) {
    a.href = url;
    a.removeAttribute('aria-disabled');
  } else {
    a.href = '#';
    a.setAttribute('aria-disabled', 'true');
  }
}

document.querySelector('#btn-whatsapp').addEventListener('click', () => {
  const p = proyectos.find(x => x.id === actualId);
  const total = totalDe(p.id);
  const cobrado = cobradoDe(p.id);
  const saldo = total - cobrado;
  const cliente = `Cliente: ${p.cliente}`;

  // 1) SOLO el presupuesto: rubros y total. Nada de cobros.
  const rub = rubros.filter(r => r.p === p.id);
  ponerEnlace('#enviar-presupuesto', rub.length ? enlaceWhatsApp(p, [
    `Presupuesto: ${p.obra}`,
    cliente,
    ...rub.map(r => `- ${r.nombre}: ${dinero(r.cantidad * r.valor)}`),
    `Total: ${dinero(total)}`
  ]) : null);

  // 2) SOLO la lista de materiales.
  const mats = materiales.filter(m => m.p === p.id);
  ponerEnlace('#enviar-materiales', mats.length ? enlaceWhatsApp(p, [
    `Lista de materiales: ${p.obra}`,
    cliente,
    ...mats.map(m => `- ${m.nombre}: ${m.cantidad} ${m.unidad}`.trim())
  ]) : null);

  // 3) SOLO los cobros entre el cliente y el contratista (nunca los pagos a trabajadores).
  const cobros = pagos.filter(x => x.p === p.id && x.tipo === 'cobro').sort((a, b) => a.fecha < b.fecha ? -1 : 1);
  ponerEnlace('#enviar-pagos', cobros.length ? enlaceWhatsApp(p, [
    `Pagos de: ${p.obra}`,
    cliente,
    'Cobros recibidos:',
    ...cobros.map(c => `- ${c.fecha}: ${dinero(c.monto)}`),
    `Total cobrado: ${dinero(cobrado)}`,
    saldo >= 0 ? `Falta por cobrar: ${dinero(saldo)}` : `Saldo a favor del cliente: ${dinero(-saldo)}`
  ]) : null);

  document.querySelector('#enviar').showModal();
});

document.querySelector('#enviar-cancelar').addEventListener('click', () => document.querySelector('#enviar').close());
document.querySelector('.opciones').addEventListener('click', e => {
  const opcion = e.target.closest('a');
  if (!opcion) return;
  if (opcion.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
  setTimeout(() => document.querySelector('#enviar').close(), 0);   // se abre WhatsApp y la ventana se cierra
});

// ===== DUPLICAR =====
document.querySelector('#btn-duplicar').addEventListener('click', () => {
  if (actualId === null) return;
  const original = proyectos.find(x => x.id === actualId);
  const copia = { ...original, id: nuevoId(), obra: original.obra + ' (copia)', inicio: '', entrega: '' };
  proyectos.push(copia);
  for (const lista of [rubros, materiales]) {                    // los pagos NO se copian: la copia empieza sin cobros
    for (const x of lista.filter(y => y.p === original.id)) {
      lista.push({ ...x, id: nuevoId(), p: copia.id });
    }
  }
  actualId = copia.id;                                           // se abre la copia
  limpiarFormRubro();
  limpiarFormMaterial();
  limpiarFormPago();
  mostrarPestana('rubros');
  dibujarDetalle();
  dibujarLista();
  guardarEnServidor();
  window.scrollTo(0, 0);
});

// ===== RESPALDO =====
function respaldoValido(o) {
  const esNum = n => typeof n === 'number' && isFinite(n);
  if (!o || typeof o !== 'object' || !Array.isArray(o.proyectos)) return false;
  for (const k of ['rubros', 'materiales', 'pagos']) {
    if (o[k] !== undefined && !Array.isArray(o[k])) return false;
  }
  const ids = new Set(o.proyectos.map(x => x && x.id));
  return o.proyectos.every(x => x && esNum(x.id) && typeof x.obra === 'string' && typeof x.cliente === 'string')
    && (o.rubros || []).every(x => x && esNum(x.id) && ids.has(x.p) && typeof x.nombre === 'string' && esNum(x.cantidad) && esNum(x.valor))
    && (o.materiales || []).every(x => x && esNum(x.id) && ids.has(x.p) && typeof x.nombre === 'string' && esNum(x.cantidad))
    && (o.pagos || []).every(x => x && esNum(x.id) && ids.has(x.p) && typeof x.fecha === 'string' && esNum(x.monto) && (x.tipo === 'cobro' || x.tipo === 'trabajador'));
}

document.querySelector('#btn-respaldo').addEventListener('click', () => {
  document.querySelector('#respaldo-texto').value = JSON.stringify({ proyectos, rubros, materiales, pagos });
  document.querySelector('#msg-respaldo').textContent = '';
});

document.querySelector('#btn-copiar').addEventListener('click', async () => {
  const caja = document.querySelector('#respaldo-texto');
  const msg = document.querySelector('#msg-respaldo');
  caja.select();
  try {
    await navigator.clipboard.writeText(caja.value);
    msg.textContent = 'Respaldo copiado. Guárdalo en un lugar seguro (por ejemplo, envíatelo por WhatsApp).';
  } catch (e) {
    msg.textContent = 'Texto seleccionado. Si no se copió solo, cópialo manualmente.';
  }
});

document.querySelector('#btn-restaurar').addEventListener('click', () => {
  const msg = document.querySelector('#msg-respaldo');
  let datos = null;
  try { datos = JSON.parse(document.querySelector('#respaldo-texto').value); } catch (e) {}
  if (!respaldoValido(datos)) {
    msg.textContent = 'Ese texto no es un respaldo válido.';
    return;
  }
  confirmar(`Se van a reemplazar todos los datos actuales por los del respaldo (${datos.proyectos.length} presupuestos). ¿Restaurar?`, () => {
    for (const [lista, nueva] of [[proyectos, datos.proyectos], [rubros, datos.rubros || []], [materiales, datos.materiales || []], [pagos, datos.pagos || []]]) {
      lista.length = 0;
      lista.push(...nueva);
      for (const x of nueva) ultimoId = Math.max(ultimoId, x.id);   // que los id nuevos no choquen con los restaurados
    }
    actualId = null;
    msg.textContent = '';
    dibujarLista();
    guardarEnServidor();
    location.hash = '#inicio';
  }, 'Sí, restaurar');
});

// ===== SERVIDOR (Node): guardar y cargar =====
// Cada vez que algo cambia se manda TODO al servidor. Al abrir la página se pide todo de vuelta.
let cargado = false;   // NUEVO: no se guarda nada hasta haber cargado bien lo que ya había en el servidor

function avisoServidor(texto) {                  // NUEVO: el aviso rojo solo se ve cuando algo falla
  const cartel = document.querySelector('#aviso-servidor');
  cartel.hidden = texto === '';
  cartel.textContent = texto;
}

async function guardarEnServidor() {
  if (!cargado) {
    avisoServidor('No se pudo cargar lo guardado en el servidor, así que NO se están guardando los cambios. Revisa que el servidor esté prendido y recarga la página (Ctrl + F5). Mientras tanto usa el Respaldo.');
    return;
  }
  try {
    const respuesta = await fetch('/api/datos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proyectos, rubros, materiales, pagos })
    });
    if (!respuesta.ok) throw new Error('El servidor respondió ' + respuesta.status);   // CAMBIO: antes un error 404 pasaba sin avisar
    avisoServidor('');
  } catch (e) {
    console.error('No se pudo guardar en el servidor', e);
    avisoServidor('No se pudo guardar en el servidor. Tus datos solo están en esta página: usa el Respaldo para no perderlos.');
  }
}

async function cargarDelServidor() {
  try {
    const respuesta = await fetch('/api/datos', { cache: 'no-store' });
    if (!respuesta.ok) throw new Error('El servidor respondió ' + respuesta.status);
    const d = await respuesta.json();
    for (const [lista, nueva] of [[proyectos, d.proyectos], [rubros, d.rubros], [materiales, d.materiales], [pagos, d.pagos]]) {
      lista.length = 0;
      lista.push(...(nueva || []));
      for (const x of lista) ultimoId = Math.max(ultimoId, x.id);   // que los id nuevos no choquen con los que vienen del servidor
    }
    cargado = true;
    avisoServidor('');
    dibujarLista();
  } catch (e) {
    console.error('No se pudo cargar del servidor', e);
    avisoServidor('No se pudo cargar lo guardado en el servidor. Revisa que el servidor esté prendido (node server.js) y que abras la página en http://localhost:3000. Los cambios NO se guardarán hasta que cargue bien.');
  }
}

if (location.hash !== '' && location.hash !== '#inicio') location.replace('#inicio');   // al recargar, siempre empieza en el inicio
cargarDelServidor();
dibujarLista();