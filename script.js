/**
 * script.js - Proforma Jardines de la Paz
 * Cálculos, generación PDF/imagen, SweetAlert (Enviar a WhatsApp, Ver PDF, Limpiar).
 * Estado de conexión vía network.js (sin eliminar; se usa updateUI).
 */
import { updateUI } from './network.js';

const VERDE = '#1a4731';
const DORADO = '#a6894a';
const STORAGE_KEY = 'jardines_de_la_paz_proforma';

function getNum(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    const v = parseFloat(String(el.value || '0').replace(',', '.'), 10);
    return isNaN(v) ? 0 : v;
}

function getStr(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
}

function getTotal() {
    return getNum('pro_lote') + getNum('pro_servicio');
}

function getNeto() {
    const total = getTotal();
    const desc = getNum('pro_descuento');
    return total + desc; // descuento suele ser negativo, ej. -1000
}

function getSumaCeldas() {
    const container = document.getElementById('cuota-celdas-container');
    if (!container) return 0;
    const inputs = container.querySelectorAll('.cuota-celda');
    let sum = 0;
    inputs.forEach(inp => {
        const v = parseFloat(String(inp.value || '0').replace(',', '.'), 10);
        sum += isNaN(v) ? 0 : v;
    });
    return Math.round(sum);
}

function updateDisplays() {
    const totalEl = document.getElementById('pro_total_display');
    const netoEl = document.getElementById('pro_neto_display');
    if (totalEl) totalEl.textContent = String(Math.round(getTotal()));
    if (netoEl) netoEl.value = String(Math.round(getNeto()));

    document.querySelectorAll('.cuota-label-text').forEach(function(span) {
        const id = span.getAttribute('data-for');
        if (id) {
            const n = Math.round(getNum(id));
            span.textContent = n === 1 ? 'cuota' : 'cuotas';
        }
    });

    let cuotas47 = 0;
    const stack = document.querySelector('.cuotas-row-stack');
    if (stack) {
        stack.querySelectorAll('.cuota-item:not(.cuota-item-total) .cuota-num').forEach(function(inp) {
            cuotas47 += Math.round(parseFloat(String(inp.value || '0').replace(',', '.'), 10) || 0);
        });
    }
    const el47 = document.getElementById('pro_cuotas_47');
    if (el47) el47.value = String(cuotas47);
}

function guardarProforma() {
    if (typeof localStorage === 'undefined') return;
    try {
        const ids = ['pro_lote', 'pro_servicio', 'pro_descuento', 'pro_neto_display', 'pro_inicial',
            'pro_cuotas_18', 'pro_monto_18', 'pro_cuotas_28', 'pro_monto_28', 'pro_cuotas_01', 'pro_monto_01',
            'pro_carencia', 'pro_reintegro', 'pro_cua', 'pro_asesora', 'pro_telefono'];
        const data = {};
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el && 'value' in el) data[id] = el.value;
        });
        const container = document.getElementById('cuota-celdas-container');
        data.celdas = [];
        if (container) {
            container.querySelectorAll('.cuota-celda').forEach(inp => data.celdas.push(inp.value || ''));
        }
        const extraCont = document.getElementById('cuotas-extra-container');
        data.extraRows = [];
        if (extraCont) {
            extraCont.querySelectorAll('.cuota-item').forEach(function(row) {
                const num = row.querySelector('.cuota-num');
                const monto = row.querySelector('.cuota-monto');
                if (num && monto) data.extraRows.push({ cuotas: num.value || '0', monto: monto.value || '0' });
            });
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
}

function cargarProforma() {
    if (typeof localStorage === 'undefined') return;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        const ids = ['pro_lote', 'pro_servicio', 'pro_descuento', 'pro_neto_display', 'pro_inicial',
            'pro_cuotas_18', 'pro_monto_18', 'pro_cuotas_28', 'pro_monto_28', 'pro_cuotas_01', 'pro_monto_01',
            'pro_carencia', 'pro_reintegro', 'pro_cua', 'pro_asesora', 'pro_telefono'];
        ids.forEach(id => {
            if (data[id] === undefined) return;
            const el = document.getElementById(id);
            if (el && 'value' in el) el.value = data[id];
        });
        const extraCont = document.getElementById('cuotas-extra-container');
        if (extraCont && Array.isArray(data.extraRows) && data.extraRows.length > 0) {
            extraCont.innerHTML = '';
            data.extraRows.forEach(function(r) {
                extraCont.appendChild(createExtraCuotaRow(r.cuotas, r.monto));
            });
            if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
        }
        const container = document.getElementById('cuota-celdas-container');
        if (container && Array.isArray(data.celdas) && data.celdas.length > 0) {
            container.innerHTML = '';
            data.celdas.forEach((val, i) => container.appendChild(createCeldaRow(val, i)));
            const btnAdd = document.getElementById('btn-add-celda');
            if (btnAdd) {
                btnAdd.disabled = container.children.length >= CELDAS_MAX;
                btnAdd.setAttribute('title', container.children.length >= CELDAS_MAX ? 'Máximo ' + CELDAS_MAX + ' celdas' : 'Agregar celda');
            }
            if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
        }
    } catch (e) {}
}

const CELDAS_MAX = 10;

function validarLimiteCeldas(inputQueCambio) {
    const principal = getNum('pro_monto_01');
    const suma = getSumaCeldas();
    if (suma <= principal) return;
    const valorActual = parseFloat(String(inputQueCambio.value || '0').replace(',', '.'), 10) || 0;
    const sumaResto = suma - valorActual;
    const maxPermitido = Math.max(0, Math.round(principal - sumaResto));
    inputQueCambio.value = String(maxPermitido);
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Límite superado',
            text: 'No puedes pasar el límite de la cantidad ' + principal + '. Suma de celdas no puede ser mayor.',
            icon: 'warning',
            confirmButtonColor: VERDE
        });
    } else {
        alert('No puedes pasar el límite de la cantidad ' + principal + '.');
    }
}

function createCeldaRow(value, index) {
    const row = document.createElement('div');
    row.className = 'cuota-celda-row';
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'cuota-celda';
    input.value = value;
    input.min = 0;
    input.setAttribute('aria-label', 'Celda ' + (index + 1));
    input.addEventListener('input', () => validarLimiteCeldas(input));
    input.addEventListener('change', () => validarLimiteCeldas(input));
    row.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-delete-celda';
    btn.title = 'Eliminar';
    btn.setAttribute('aria-label', 'Eliminar celda');
    btn.innerHTML = '<i data-lucide="trash-2"></i>';
    btn.addEventListener('click', () => {
        const container = document.getElementById('cuota-celdas-container');
        const btnAdd = document.getElementById('btn-add-celda');
        if (!container) return;

        row.remove();
        guardarProforma();
        if (btnAdd && container.children.length < CELDAS_MAX) {
            btnAdd.disabled = false;
            btnAdd.setAttribute('title', 'Agregar celda');
        }
    });
    row.appendChild(btn);
    return row;
}

function createExtraCuotaRow(cuotasVal, montoVal, index) {
    const container = document.getElementById('cuotas-extra-container');
    const idx = index !== undefined ? index : (container ? container.children.length : 0);
    const idNum = 'pro_cuotas_extra_' + idx;
    const idMonto = 'pro_monto_extra_' + idx;

    const row = document.createElement('span');
    row.className = 'cuota-item cuota-item-extra';

    const inputNum = document.createElement('input');
    inputNum.type = 'number';
    inputNum.id = idNum;
    inputNum.value = cuotasVal !== undefined ? cuotasVal : '';
    inputNum.min = 0;
    inputNum.className = 'cuota-num';
    inputNum.setAttribute('aria-label', 'Número de cuotas');

    const labelSpan = document.createElement('span');
    labelSpan.className = 'cuota-label';
    labelSpan.innerHTML = '<span class="cuota-label-text" data-for="' + idNum + '">cuotas</span> <span class="cuota-arrow">---></span>';

    const inputMonto = document.createElement('input');
    inputMonto.type = 'number';
    inputMonto.id = idMonto;
    inputMonto.value = montoVal !== undefined ? montoVal : '';
    inputMonto.min = 0;
    inputMonto.className = 'cuota-monto';
    inputMonto.setAttribute('aria-label', 'Monto cuota');

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn-delete-celda btn-delete-extra-row';
    btnDel.title = 'Eliminar';
    btnDel.setAttribute('aria-label', 'Eliminar opción');
    btnDel.innerHTML = '<i data-lucide="trash-2"></i>';
    btnDel.addEventListener('click', function() {
        row.remove();
        updateDisplays();
        guardarProforma();
    });

    row.appendChild(inputNum);
    row.appendChild(labelSpan);
    row.appendChild(inputMonto);
    row.appendChild(btnDel);
    return row;
}

function agregarFilaCuota() {
    const container = document.getElementById('cuotas-extra-container');
    if (!container) return;
    const newRow = createExtraCuotaRow('', '');
    container.insertBefore(newRow, container.firstChild);
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    updateDisplays();
    guardarProforma();
}

function resetCeldasCuota480() {
    const cont = document.getElementById('cuota-celdas-container');
    if (!cont) return;
    cont.innerHTML = '';
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function agregarCeldaCuota480() {
    const cont = document.getElementById('cuota-celdas-container');
    const btnAdd = document.getElementById('btn-add-celda');
    if (!cont || cont.children.length >= CELDAS_MAX) return;
    const index = cont.children.length;
    cont.appendChild(createCeldaRow('', index));
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
    if (btnAdd && cont.children.length >= CELDAS_MAX) {
        btnAdd.disabled = true;
        btnAdd.setAttribute('title', 'Máximo ' + CELDAS_MAX + ' celdas');
    } else if (btnAdd) {
        btnAdd.disabled = false;
        btnAdd.setAttribute('title', 'Agregar celda');
    }
    guardarProforma();
}

function limpiarForm() {
    const defaults = {
        pro_lote: 8570,
        pro_servicio: 2148,
        pro_descuento: -1000,
        pro_inicial: 1052,
        pro_cuotas_18: 18,
        pro_monto_18: 209,
        pro_cuotas_28: 28,
        pro_monto_28: 158,
        pro_cuotas_01: 1,
        pro_monto_01: 480,
        pro_cuotas_47: 47,
        pro_carencia: 30,
        pro_reintegro: 1400,
        pro_cua: 600,
        pro_asesora: 'Guadalupe Antunez',
        pro_telefono: '966192366'
    };
    Object.keys(defaults).forEach(id => {
        const el = document.getElementById(id);
        if (el && 'value' in el) el.value = defaults[id];
    });
    resetCeldasCuota480();
    const btnAdd = document.getElementById('btn-add-celda');
    if (btnAdd) {
        btnAdd.disabled = false;
        btnAdd.setAttribute('title', 'Agregar celda');
    }
    updateDisplays();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

/** Valores actuales de las celdas de la cuota 480 (para PDF en tiempo real) */
function getCeldasValores() {
    const container = document.getElementById('cuota-celdas-container');
    if (!container) return [];
    const inputs = container.querySelectorAll('.cuota-celda');
    return Array.from(inputs).map(inp => {
        const v = parseFloat(String(inp.value || '0').replace(',', '.'), 10);
        return isNaN(v) ? 0 : v;
    });
}

function generarPDFBlob() {
    const JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) return Promise.resolve(null);
    const doc = new JsPDF('p', 'mm', 'a4');
    const pageW = 210;
    const contentW = 170;
    const m = (pageW - contentW) / 2;
    const rightX = m + contentW;
    const verde = [26, 71, 49];
    const dorado = [166, 137, 74];
    const texto = [51, 51, 51];
    const pad = 4;
    const rowH = 8;
    const borderHalf = 0.35 / 2;
    let y = 16;

    const total = Math.round(getTotal());
    const neto = Math.round(getNum('pro_neto_display') || getNeto());

    function drawTableHeader(doc, x, y, w, title) {
        doc.setFillColor(...verde);
        doc.rect(x, y, w, rowH, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.text(title, x + pad, y + 5.5);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...texto);
        return y + rowH;
    }

    function drawRow(doc, x, y, w, label, value, boldLabel) {
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.35);
        doc.line(x, y, x + w, y);
        if (boldLabel) doc.setFont(undefined, 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...texto);
        doc.text(label, x + pad, y + 5.5);
        doc.text(String(value), x + w - pad, y + 5.5, { align: 'right' });
        if (boldLabel) doc.setFont(undefined, 'normal');
        return y + rowH;
    }

    function drawBoxTitle(doc, x, y, w, title) {
        doc.setDrawColor(...verde);
        doc.setLineWidth(0.35);
        doc.setFillColor(240, 248, 242);
        doc.rect(x, y, w, rowH + 2, 'FD');
        doc.setTextColor(...verde);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.text(title, x + pad, y + 6);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...texto);
        return y + rowH + 2;
    }

    // --- Cabecera empresarial ---
    doc.setDrawColor(...dorado);
    doc.setLineWidth(0.35);
    doc.line(m, y, rightX, y);
    y += 10;
    doc.setTextColor(...verde);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('PROFORMA', pageW / 2, y, { align: 'center' });
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...texto);
    y += 8;

    // --- Tabla: Detalle de costos ---
    y = drawTableHeader(doc, m, y, contentW, 'DETALLE DE COSTOS');
    const costos = [
        ['Lote doble encofrado', getNum('pro_lote')],
        ['Servicio funerario estándar', getNum('pro_servicio')],
        ['Total', total],
        ['Descuento SIS (Deuda pend.)', getNum('pro_descuento')]
    ];
    costos.forEach(function (item) {
        y = drawRow(doc, m, y, contentW, item[0], item[1], item[0] === 'Total');
    });
    y += 2;

    // --- Total con descuento e Inicial (cajas destacadas) ---
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.setFillColor(248, 250, 248);
    doc.rect(m, y, contentW, rowH + 4, 'FD');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...verde);
    doc.text('Total con descuento', m + pad, y + 6);
    doc.text(String(neto) + ' S/', rightX - pad, y + 6, { align: 'right' });
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...texto);
    y += rowH + 6;

    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.rect(m, y, contentW, rowH + 2, 'S');
    doc.setFont(undefined, 'bold');
    doc.text('Inicial', m + pad, y + 5.5);
    doc.text(String(getNum('pro_inicial')) + ' S/', rightX - pad, y + 5.5, { align: 'right' });
    doc.setFont(undefined, 'normal');
    y += rowH + 6;

    // --- Tabla: Saldo (título + tabla en un solo bloque, bordes cerrados) ---
    const saldoRows = [];
    const stackEl = document.querySelector('.cuotas-row-stack');
    if (stackEl) {
        stackEl.querySelectorAll('.cuota-item:not(.cuota-item-total)').forEach(function (row) {
            const nEl = row.querySelector('.cuota-num');
            const mEl = row.querySelector('.cuota-monto');
            if (!nEl || !mEl) return;
            const num = parseFloat(String(nEl.value || '0').replace(',', '.'), 10) || 0;
            const monto = mEl.value || '0';
            let desglose = '';
            const celdasCont = row.querySelector('.cuota-celdas-container');
            if (celdasCont) {
                const celdas = Array.from(celdasCont.querySelectorAll('.cuota-celda')).map(function (inp) {
                    const x = parseFloat(String(inp.value || '0').replace(',', '.'), 10);
                    return isNaN(x) ? '' : String(x);
                }).filter(function (v) { return v !== '' && v !== '0'; });
                if (celdas.length) desglose = celdas.join(', ');
            }
            if (!desglose) desglose = '-';
            saldoRows.push([num + (num === 1 ? ' cuota' : ' cuotas'), monto + ' S/', desglose]);
        });
    }
    const col1 = 50;
    const col2 = 55;
    const saldoTitleH = rowH + 2;
    const saldoHeaderH = rowH;
    const saldoDataH = saldoRows.length * rowH;
    const saldoTotalH = rowH;
    const saldoBlockH = saldoTitleH + saldoHeaderH + saldoDataH + saldoTotalH;
    const saldoTopY = y;
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.line(m, y, m + contentW, y);
    doc.line(m, y + saldoBlockH, m + contentW, y + saldoBlockH);
    doc.line(m + borderHalf, y, m + borderHalf, y + saldoBlockH);
    doc.line(m + contentW, y, m + contentW, y + saldoBlockH);
    doc.setFillColor(240, 248, 242);
    doc.rect(m, y, contentW, saldoTitleH, 'F');
    doc.setFillColor(248, 248, 248);
    doc.rect(m, y + saldoTitleH, contentW, saldoBlockH - saldoTitleH, 'F');
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.line(m, y + saldoTitleH, m + contentW, y + saldoTitleH);
    doc.line(m, y + saldoTitleH + saldoHeaderH, m + contentW, y + saldoTitleH + saldoHeaderH);
    doc.line(m + col1, y + saldoTitleH, m + col1, y + saldoBlockH);
    doc.line(m + col1 + col2, y + saldoTitleH, m + col1 + col2, y + saldoBlockH);
    for (let i = 1; i <= saldoRows.length; i++) {
        doc.setDrawColor(200, 200, 200);
        doc.line(m, y + saldoTitleH + saldoHeaderH + i * rowH, m + contentW, y + saldoTitleH + saldoHeaderH + i * rowH);
    }
    doc.setDrawColor(200, 200, 200);
    doc.line(m, y + saldoTitleH + saldoHeaderH + saldoDataH, m + contentW, y + saldoTitleH + saldoHeaderH + saldoDataH);
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.line(m + borderHalf, y, m + borderHalf, y + saldoBlockH);
    doc.line(m + contentW, y, m + contentW, y + saldoBlockH);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...verde);
    doc.text('SALDO - OPCIONES DE CUOTAS', m + pad, y + 6);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...texto);
    y += saldoTitleH;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...verde);
    doc.text('Opción', m + 2, y + 5.5);
    doc.text('Monto', m + col1 + 2, y + 5.5);
    doc.text('Desglose', m + col1 + col2 + 2, y + 5.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...texto);
    y += saldoHeaderH;
    saldoRows.forEach(function (r) {
        doc.setFontSize(9);
        doc.text(r[0], m + 2, y + 5.5);
        doc.text(r[1], m + col1 + col2 - 2, y + 5.5, { align: 'right' });
        doc.text(r[2], m + col1 + col2 + 2, y + 5.5);
        y += rowH;
    });
    doc.setFont(undefined, 'bold');
    doc.text('Total: ' + getNum('pro_cuotas_47') + ' Cuotas', m + 2, y + 5.5);
    doc.setFont(undefined, 'normal');
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.line(m, saldoTopY, m + contentW, saldoTopY);
    doc.line(m, saldoTopY + saldoBlockH, m + contentW, saldoTopY + saldoBlockH);
    doc.line(m + borderHalf, saldoTopY, m + borderHalf, saldoTopY + saldoBlockH);
    doc.line(m + contentW, saldoTopY, m + contentW, saldoTopY + saldoBlockH);
    y += saldoTotalH + 2;

    // --- Tabla: Términos (título y 2 columnas en un solo bloque, sin hueco) ---
    y += 3;
    const termTopY = y;
    const termRowH = 8;
    const termH = termRowH * 3;
    const termTotalH = rowH + termH;
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.line(m, y, m + contentW, y);
    doc.line(m, y + termTotalH, m + contentW, y + termTotalH);
    doc.line(m + borderHalf, y, m + borderHalf, y + termTotalH);
    doc.line(m + contentW, y, m + contentW, y + termTotalH);
    doc.setFillColor(240, 248, 242);
    doc.rect(m, y, contentW, rowH, 'F');
    doc.setFillColor(248, 248, 248);
    doc.rect(m, y + rowH, contentW, termH, 'F');
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.line(m, y + rowH, m + contentW, y + rowH);
    doc.line(m + contentW * 0.5, y + rowH, m + contentW * 0.5, y + termTotalH);
    doc.line(m, y + rowH + termRowH, m + contentW, y + rowH + termRowH);
    doc.line(m, y + rowH + termRowH * 2, m + contentW, y + rowH + termRowH * 2);
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.line(m + borderHalf, y, m + borderHalf, y + termTotalH);
    doc.line(m + contentW, y, m + contentW, y + termTotalH);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...verde);
    doc.text('TÉRMINOS', m + contentW / 2, y + 6, { align: 'center' });
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...texto);
    doc.setFontSize(9);
    const terms = [
        ['Periodo de carencia', String(getNum('pro_carencia')) + ' Días'],
        ['Reintegro', String(getNum('pro_reintegro')) + ' Soles'],
        ['CUA', String(getNum('pro_cua')) + ' Soles']
    ];
    const termPad = 12;
    const termTextYOffset = 0.5;
    terms.forEach(function (t, i) {
        const yy = y + rowH + (i + 0.5) * termRowH;
        const textY = yy + termTextYOffset;
        const xLeft = m + termPad + (contentW / 2 - termPad * 2) / 2;
        const xRight = m + contentW / 2 + termPad + (contentW / 2 - termPad * 2) / 2;
        const w0 = doc.getTextWidth(t[0]);
        const w1 = doc.getTextWidth(t[1]);
        doc.text(t[0], xLeft - w0 / 2, textY);
        doc.text(t[1], xRight - w1 / 2, textY);
    });
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('se paga cuando se usa el espacio', m + pad, y + termTotalH + 4);
    doc.setTextColor(...texto);
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.line(m, termTopY, m + contentW, termTopY);
    doc.line(m, termTopY + termTotalH, m + contentW, termTopY + termTotalH);
    doc.line(m + borderHalf, termTopY, m + borderHalf, termTopY + termTotalH);
    doc.line(m + contentW, termTopY, m + contentW, termTopY + termTotalH);
    y += termTotalH + 8;

    // --- Contacto ---
    y = drawBoxTitle(doc, m, y, contentW, 'CONTACTO');
    const contactoH = rowH * 2 + 4;
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.line(m, y, m + contentW, y);
    doc.line(m, y + contactoH, m + contentW, y + contactoH);
    doc.line(m + borderHalf, y, m + borderHalf, y + contactoH);
    doc.line(m + contentW, y, m + contentW, y + contactoH);
    doc.setFontSize(9);
    doc.text('Asesora comercial: ' + getStr('pro_asesora'), m + pad, y + 6);
    doc.text('Teléfono: ' + getStr('pro_telefono'), m + pad, y + 6 + rowH);
    doc.setFont(undefined, 'normal');

    return Promise.resolve(doc.output('blob'));
}

function generarImagenBlob() {
    if (typeof html2canvas === 'undefined') return Promise.resolve(null);
    const el = document.getElementById('proforma-content');
    if (!el) return Promise.resolve(null);
    return html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
    }).then(canvas => {
        return new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob || null), 'image/png', 0.95);
        });
    }).catch(() => null);
}

function abrirSweetAlertOpciones() {
    const hasSwal = typeof Swal !== 'undefined';
    if (!hasSwal) {
        if (window.jspdf && window.jspdf.jsPDF) {
            generarPDFBlob().then(blob => {
                if (blob) window.open(URL.createObjectURL(blob), '_blank');
            });
        }
        return;
    }

    Swal.fire({
        title: 'Proforma lista',
        html: 'Elige una opción:',
        icon: 'info',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Enviar a WhatsApp',
        denyButtonText: 'Ver PDF',
        cancelButtonText: 'Limpiar',
        confirmButtonColor: VERDE,
        denyButtonColor: DORADO,
        cancelButtonColor: '#666'
    }).then(result => {
        if (result.isDismissed && result.dismiss === 'cancel') {
            limpiarForm();
            Swal.fire({ title: 'Listo', text: 'Formulario limpiado.', icon: 'success', confirmButtonColor: VERDE });
            return;
        }
        if (result.isConfirmed) {
            enviarAWhatsApp();
            return;
        }
        if (result.isDenied) {
            verPDF();
        }
    });
}

function verPDF() {
    generarPDFBlob().then(blob => {
        if (!blob) {
            if (typeof Swal !== 'undefined') Swal.fire({ title: 'Error', text: 'No se pudo generar el PDF.', icon: 'error', confirmButtonColor: VERDE });
            else alert('No se pudo generar el PDF.');
            return;
        }
        const url = URL.createObjectURL(blob);
        window.open(url + '#zoom=page-width', '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
}

function enviarAWhatsApp() {
    const shareData = { title: 'Proforma Jardines de la Paz', text: 'Proforma - Jardines de la Paz. Plan Legado Familiar.' };
    generarPDFBlob().then(pdfBlob => {
        generarImagenBlob().then(imgBlob => {
            const file = pdfBlob || imgBlob;
            if (file) {
                const f = new File([file], 'Proforma-Jardines-de-la-Paz.' + (pdfBlob ? 'pdf' : 'png'), { type: file.type });
                if (navigator.share && navigator.canShare && navigator.canShare({ files: [f] })) {
                    shareData.files = [f];
                    navigator.share(shareData).then(() => {
                        if (typeof Swal !== 'undefined') Swal.fire({ title: 'Enviado', text: 'Compartido correctamente.', icon: 'success', confirmButtonColor: VERDE });
                    }).catch(() => abrirEnlaceWa(shareData.text));
                } else {
                    const url = URL.createObjectURL(file);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'Proforma-Jardines-de-la-Paz.' + (pdfBlob ? 'pdf' : 'png');
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                    abrirEnlaceWa(shareData.text);
                    if (typeof Swal !== 'undefined') Swal.fire({
                        title: 'Descarga lista',
                        text: 'Se descargó el archivo. Abriendo WhatsApp para que puedas enviarlo.',
                        icon: 'success',
                        confirmButtonColor: VERDE
                    });
                }
            } else {
                abrirEnlaceWa(shareData.text);
            }
        });
    });
}

function abrirEnlaceWa(texto) {
    const t = encodeURIComponent(texto || 'Proforma Jardines de la Paz');
    window.open('https://wa.me/?text=' + t, '_blank');
}

// Estado de conexión
updateUI();
window.addEventListener('online', () => updateUI());
window.addEventListener('offline', () => updateUI());

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .then(() => {})
        .catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
    cargarProforma();
    updateDisplays();
    const container = document.getElementById('proforma-content');
    let saveTimeout;
    function guardarConRetraso() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(guardarProforma, 200);
    }
    if (container) {
        container.addEventListener('input', () => { updateDisplays(); guardarConRetraso(); });
        container.addEventListener('change', () => { updateDisplays(); guardarProforma(); });
    }
    window.addEventListener('beforeunload', guardarProforma);
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') guardarProforma();
    });
    setTimeout(guardarProforma, 500);

    const btn = document.getElementById('btn-generate');
    if (btn) {
        btn.addEventListener('click', () => abrirSweetAlertOpciones());
    }

    const btnAddCelda = document.getElementById('btn-add-celda');
    if (btnAddCelda) {
        btnAddCelda.addEventListener('click', agregarCeldaCuota480);
    }

    const btnAddCuotaRow = document.getElementById('btn-add-cuota-row');
    if (btnAddCuotaRow) {
        btnAddCuotaRow.addEventListener('click', agregarFilaCuota);
    }
    const proformaContent = document.getElementById('proforma-content');
    if (proformaContent) {
        proformaContent.addEventListener('click', function(e) {
            const btn = e.target.closest('.btn-delete-cuota-row');
            if (!btn) return;
            const row = btn.closest('.cuota-item');
            if (row && !row.classList.contains('cuota-item-total')) {
                row.remove();
                updateDisplays();
                guardarProforma();
            }
        });
    }

    const btnSaldoInfo = document.getElementById('btn-saldo-info');
    if (btnSaldoInfo) {
        btnSaldoInfo.addEventListener('click', function() {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: '¿De qué trata?',
                    text: 'Solo el monto está dividido en partes; lo demás no. La suma nunca debe pasar el monto principal.',
                    icon: 'info',
                    confirmButtonText: 'Entendido',
                    confirmButtonColor: VERDE
                });
            } else {
                alert('Solo el monto está dividido en partes; lo demás no. La suma nunca debe pasar el monto principal.');
            }
        });
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
});
