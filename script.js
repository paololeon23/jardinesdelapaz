/**
 * script.js - Proforma Jardines de la Paz
 * Cálculos, generación PDF/imagen, SweetAlert (Enviar a WhatsApp, Ver PDF, Limpiar).
 * Estado de conexión vía network.js (sin eliminar; se usa updateUI).
 */
import { updateUI } from './network.js';

const VERDE = '#1a4731';
const DORADO = '#a6894a';
const STORAGE_KEY = 'jardines_de_la_paz_proforma';

const DEFAULT_LABELS = {
    pro_lote: 'Lote doble encofrado',
    pro_servicio: 'Servicio funerario estándar',
    pro_total: 'Total',
    pro_descuento: 'Descuento SIS (Deuda pend.)'
};

function getLabel(id) {
    const el = document.getElementById('label_' + id);
    if (!el) return DEFAULT_LABELS[id] || '';
    const t = String(el.textContent || '').trim();
    return t || DEFAULT_LABELS[id] || '';
}

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
    let s = getNum('pro_lote') + getNum('pro_servicio');
    document.querySelectorAll('.proforma-grid [id^="pro_extra_"]').forEach(function (el) {
        if (el.id && el.value !== undefined) s += parseFloat(String(el.value || '0').replace(',', '.'), 10) || 0;
    });
    return s;
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
            'pro_carencia', 'pro_reintegro', 'pro_cua', 'pro_asesora', 'pro_telefono', 'pro_datos', 'pro_celular', 'pro_direccion', 'pro_codigo'];
        const data = {};
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el && 'value' in el) data[id] = el.value;
        });
        data.labels = {};
        ['pro_lote', 'pro_servicio', 'pro_total', 'pro_descuento'].forEach(id => {
            const lab = document.getElementById('label_' + id);
            if (lab) data.labels[id] = lab.textContent || DEFAULT_LABELS[id] || '';
        });
        data.deletedCostRows = [];
        ['pro_lote', 'pro_servicio', 'pro_descuento'].forEach(id => {
            if (!document.getElementById(id)) data.deletedCostRows.push(id);
        });
        data.extraCostRows = [];
        document.querySelectorAll('.proforma-grid-row[data-row-id^="pro_extra_"]').forEach(function (row) {
            const id = row.getAttribute('data-row-id');
            const labelEl = document.getElementById('label_' + id);
            const valueEl = document.getElementById(id);
            if (id && labelEl && valueEl) data.extraCostRows.push({ id: id, label: labelEl.textContent || '', value: valueEl.value || '' });
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
        data.nivelRows = [];
        const nivelCont = document.getElementById('term-nivel-rows');
        if (nivelCont) {
            nivelCont.querySelectorAll('.term-nivel-row').forEach(function(row) {
                const sel = row.querySelector('.term-nivel-select');
                if (sel) data.nivelRows.push(sel.value || 'PAGA');
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
            'pro_carencia', 'pro_reintegro', 'pro_cua', 'pro_asesora', 'pro_telefono', 'pro_datos', 'pro_celular', 'pro_direccion', 'pro_codigo'];
        ids.forEach(id => {
            if (data[id] === undefined) return;
            const el = document.getElementById(id);
            if (el && 'value' in el) el.value = data[id];
        });
        if (data.labels && typeof data.labels === 'object') {
            Object.keys(data.labels).forEach(id => {
                const lab = document.getElementById('label_' + id);
                if (lab && data.labels[id]) lab.textContent = data.labels[id];
            });
        }
        (data.deletedCostRows || []).forEach(id => {
            const row = document.querySelector('.proforma-grid-row[data-row-id="' + id + '"]');
            if (row) row.remove();
        });
        (data.extraCostRows || []).forEach(function (item) {
            if (item.id && item.label !== undefined) agregarFilaCosto(item.id, item.label, item.value);
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
        /* Nivel: no restaurar filas al cargar; solo se muestra el icono + hasta que el usuario pulse */
    } catch (e) {}
}

const NIVEL_MAX = 4;

function crearNivelRowHtml(nivelNum, selectValue) {
    const val = selectValue === 'NO PAGA' ? 'NO PAGA' : 'PAGA';
    return '<div class="term-nivel-row" data-nivel="' + nivelNum + '">' +
        '<div class="term-nivel-row-inner">' +
        '<span class="term-nivel-col term-nivel-label">' + nivelNum + ' NIVEL</span>' +
        '<span class="term-nivel-col term-nivel-input-wrap">' +
        '<select class="term-nivel-select" aria-label="Paga o no paga">' +
        '<option value="PAGA"' + (val === 'PAGA' ? ' selected' : '') + '>PAGA</option>' +
        '<option value="NO PAGA"' + (val === 'NO PAGA' ? ' selected' : '') + '>NO PAGA</option>' +
        '</select>' +
        '</span>' +
        '</div>' +
        '<button type="button" class="btn-delete-nivel" title="Eliminar nivel" aria-label="Eliminar nivel"><i data-lucide="trash-2"></i></button>' +
        '</div>';
}

function renumerarNivelRows() {
    const container = document.getElementById('term-nivel-rows');
    if (!container) return;
    const rows = container.querySelectorAll('.term-nivel-row');
    rows.forEach(function (row, i) {
        const n = i + 1;
        row.setAttribute('data-nivel', String(n));
        const label = row.querySelector('.term-nivel-label');
        if (label) label.textContent = n + ' NIVEL';
    });
}

function actualizarVisibilidadNivelBox() {
    const container = document.getElementById('term-nivel-rows');
    const box = document.getElementById('term-nivel-box');
    const wrapper = box && box.parentElement;
    const termsBox = document.querySelector('.proforma-box-terms');
    if (!container || !box || !wrapper) return;
    const cnt = container.children.length;
    box.style.display = cnt > 0 ? '' : 'none';
    if (termsBox) termsBox.classList.toggle('nivel-max', cnt >= NIVEL_MAX);
}

function rebuildNivelRows(values) {
    const container = document.getElementById('term-nivel-rows');
    if (!container) return;
    container.innerHTML = '';
    (values || []).forEach(function (val, i) {
        const n = i + 1;
        const div = document.createElement('div');
        div.innerHTML = crearNivelRowHtml(n, val);
        container.appendChild(div.firstElementChild);
    });
    actualizarVisibilidadNivelBox();
}

function agregarNivelRow() {
    const container = document.getElementById('term-nivel-rows');
    if (!container) return;
    const cnt = container.children.length;
    if (cnt >= NIVEL_MAX) return;
    const n = cnt + 1;
    const div = document.createElement('div');
    div.innerHTML = crearNivelRowHtml(n, 'PAGA');
    container.appendChild(div.firstElementChild);
    actualizarVisibilidadNivelBox();
    guardarProforma();
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
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

function crearFilaCuotaSaldo(idCuotas, idMonto, valueCuotas, valueMonto) {
    const span = document.createElement('span');
    span.className = 'cuota-item cuota-item-deletable';
    span.innerHTML = '<input type="number" id="' + idCuotas + '" value="' + valueCuotas + '" min="1" class="cuota-num" aria-label="Número de cuotas">' +
        '<span class="cuota-label"><span class="cuota-label-text" data-for="' + idCuotas + '">cuotas</span> <span class="cuota-arrow">---></span></span>' +
        '<input type="number" id="' + idMonto + '" value="' + valueMonto + '" min="0" class="cuota-monto" aria-label="Monto cuota">' +
        '<button type="button" class="btn-delete-celda btn-delete-cuota-row" title="Eliminar" aria-label="Eliminar opción"><i data-lucide="trash-2"></i></button>';
    return span;
}

function restauraFilasCuotaSaldo() {
    const stack = document.querySelector('.cuotas-row-stack');
    if (!stack) return;
    const refRow = stack.querySelector('.cuota-item-con-celdas');
    if (!refRow) return;
    if (!document.getElementById('pro_cuotas_28')) {
        const row28 = crearFilaCuotaSaldo('pro_cuotas_28', 'pro_monto_28', 28, 158);
        stack.insertBefore(row28, refRow);
    }
    if (!document.getElementById('pro_cuotas_18')) {
        const row18 = crearFilaCuotaSaldo('pro_cuotas_18', 'pro_monto_18', 18, 209);
        stack.insertBefore(row18, refRow);
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
    // Restaurar las 3 filas de costos por defecto si el usuario las eliminó
    restauraFilasEliminadas();
    // Quitar todas las filas extra que el usuario añadió con "+" (detalle de costos)
    document.querySelectorAll('.proforma-grid-row[data-row-id^="pro_extra_"]').forEach(function (row) {
        row.remove();
    });
    // Saldo: vaciar opciones de cuotas añadidas con "+" y restaurar 18 y 28 cuotas si se eliminaron
    const extraCont = document.getElementById('cuotas-extra-container');
    if (extraCont) extraCont.innerHTML = '';
    restauraFilasCuotaSaldo();

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
        pro_telefono: '966192366',
        pro_datos: '',
        pro_celular: '',
        pro_direccion: '',
        pro_codigo: ''
    };
    Object.keys(defaults).forEach(id => {
        const el = document.getElementById(id);
        if (el && 'value' in el) el.value = defaults[id];
    });
    resetCeldasCuota480();
    rebuildNivelRows([]);
    const btnAdd = document.getElementById('btn-add-celda');
    if (btnAdd) {
        btnAdd.disabled = false;
        btnAdd.setAttribute('title', 'Agregar celda');
    }
    updateDisplays();
    Object.keys(DEFAULT_LABELS).forEach(id => {
        const lab = document.getElementById('label_' + id);
        if (lab) lab.textContent = DEFAULT_LABELS[id];
    });
    actualizarVisibilidadRestaurarFilas();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
}

const COST_ROW_DEFAULTS = { pro_lote: { label: 'Lote doble encofrado', value: 8570 }, pro_servicio: { label: 'Servicio funerario estándar', value: 2148 }, pro_descuento: { label: 'Descuento SIS (Deuda pend.)', value: -1000 } };

function crearCostRowHTML(rowId) {
    const d = COST_ROW_DEFAULTS[rowId];
    if (!d) return '';
    const label = (d.label || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return '<div class="proforma-grid-row proforma-row-inline" data-row-id="' + rowId + '">' +
        '<label for="' + rowId + '" id="label_' + rowId + '" class="proforma-label">' + label + '</label>' +
        '<button type="button" class="btn-edit-row" data-row="' + rowId + '" title="Editar" aria-label="Editar fila"><i data-lucide="pencil"></i></button>' +
        '<span class="proforma-arrow" aria-hidden="true">-----></span>' +
        '<div class="proforma-value-box">' +
        '<input type="number" id="' + rowId + '" name="' + rowId + '" value="' + d.value + '" min="0" step="1" aria-label="' + rowId + '">' +
        '</div>' +
        '<button type="button" class="btn-delete-cost-row" data-row="' + rowId + '" title="Eliminar" aria-label="Eliminar fila"><i data-lucide="trash-2"></i></button>' +
        '</div>';
}

function restauraFilasEliminadas() {
    const grid = document.querySelector('.proforma-grid');
    if (!grid) return;
    const toRestore = ['pro_lote', 'pro_servicio', 'pro_descuento'].filter(id => !document.getElementById(id));
    const sortOrder = { pro_lote: 0, pro_servicio: 1, pro_descuento: 2 };
    toRestore.sort((a, b) => sortOrder[a] - sortOrder[b]);
    if (toRestore.length === 0) {
        const wrap = document.getElementById('restore-rows-wrap');
        if (wrap) wrap.style.display = 'none';
        return;
    }
    toRestore.forEach(rowId => {
        const html = crearCostRowHTML(rowId);
        if (!html) return;
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const row = temp.firstElementChild;
        if (!row) return;
        const refRow = grid.querySelector('[data-row-id="pro_total"]');
        if (rowId === 'pro_descuento') {
            if (refRow && refRow.nextElementSibling) grid.insertBefore(row, refRow.nextElementSibling);
            else grid.appendChild(row);
        } else {
            const before = rowId === 'pro_lote' ? grid.firstElementChild : grid.querySelector('[data-row-id="pro_total"]');
            if (before) grid.insertBefore(row, before);
            else grid.appendChild(row);
        }
    });
    updateDisplays();
    guardarProforma();
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    const wrap = document.getElementById('restore-rows-wrap');
    if (wrap) wrap.style.display = 'none';
}

function actualizarVisibilidadRestaurarFilas() {
    const wrap = document.getElementById('restore-rows-wrap');
    const container = document.getElementById('wrap-restore-add-buttons');
    if (!wrap) return;
    const falta = !document.getElementById('pro_lote') || !document.getElementById('pro_servicio') || !document.getElementById('pro_descuento');
    wrap.style.display = falta ? 'inline' : 'none';
    if (container) container.style.display = falta ? 'flex' : 'none';
}

function getNextExtraCostId() {
    const existing = document.querySelectorAll('.proforma-grid-row[data-row-id^="pro_extra_"]');
    let n = 0;
    existing.forEach(function (row) {
        const id = row.getAttribute('data-row-id');
        if (id && id.startsWith('pro_extra_')) {
            const num = parseInt(id.replace('pro_extra_', ''), 10);
            if (!isNaN(num) && num >= n) n = num + 1;
        }
    });
    return 'pro_extra_' + n;
}

function agregarFilaCosto(rowId, labelText, value) {
    const grid = document.querySelector('.proforma-grid');
    if (!grid) return;
    const label = (labelText || 'Texto / Valor').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const val = (value === undefined || value === null) ? '' : String(value).replace(/"/g, '&quot;');
    const html = '<div class="proforma-grid-row proforma-row-inline" data-row-id="' + rowId + '">' +
        '<label for="' + rowId + '" id="label_' + rowId + '" class="proforma-label">' + label + '</label>' +
        '<button type="button" class="btn-edit-row" data-row="' + rowId + '" title="Editar" aria-label="Editar fila"><i data-lucide="pencil"></i></button>' +
        '<span class="proforma-arrow" aria-hidden="true">-----></span>' +
        '<div class="proforma-value-box">' +
        '<input type="number" id="' + rowId + '" name="' + rowId + '" value="' + val + '" min="0" step="1" aria-label="Valor">' +
        '</div>' +
        '<button type="button" class="btn-delete-cost-row" data-row="' + rowId + '" title="Eliminar" aria-label="Eliminar fila"><i data-lucide="trash-2"></i></button>' +
        '</div>';
    const refRow = grid.querySelector('[data-row-id="pro_total"]');
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const row = temp.firstElementChild;
    if (!row) return;
    if (refRow) grid.insertBefore(row, refRow);
    else grid.appendChild(row);
    updateDisplays();
    guardarProforma();
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
}

function abrirEditarFila(rowId) {
    const labelEl = document.getElementById('label_' + rowId);
    const valueEl = document.getElementById(rowId);
    const isTotal = rowId === 'pro_total';
    const currentLabel = labelEl ? labelEl.textContent : (DEFAULT_LABELS[rowId] || '');
    const currentValue = valueEl && 'value' in valueEl ? valueEl.value : (rowId === 'pro_total' ? String(getTotal()) : '');

    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const html = isTotal
        ? '<p style="text-align:left;margin:0 0 6px 0;color:#333;font-weight:600">Etiqueta</p><input id="swal-etiqueta" class="swal2-input" value="' + esc(currentLabel) + '" placeholder="Ej: Total">'
        : '<p style="text-align:left;margin:0 0 6px 0;color:#333;font-weight:600">Etiqueta</p><input id="swal-etiqueta" class="swal2-input" value="' + esc(currentLabel) + '" placeholder="Nombre del concepto">' +
          '<p style="text-align:left;margin:12px 0 6px 0;color:#333;font-weight:600">Valor</p><input type="number" id="swal-valor" class="swal2-input" value="' + esc(currentValue || '0') + '" placeholder="Monto">';

    if (typeof Swal === 'undefined') {
        const lab = prompt('Etiqueta:', currentLabel);
        if (lab != null && labelEl) labelEl.textContent = lab;
        if (!isTotal && valueEl) {
            const val = prompt('Valor:', currentValue);
            if (val != null) valueEl.value = val;
        }
        updateDisplays();
        guardarProforma();
        return;
    }

    Swal.fire({
        title: 'Editar fila',
        html: html,
        showCancelButton: true,
        confirmButtonText: 'Actualizar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: VERDE,
        cancelButtonColor: '#888',
        didOpen: () => {
            const etiq = document.getElementById('swal-etiqueta');
            const val = document.getElementById('swal-valor');
            if (etiq) etiq.focus();
            if (val && !isTotal) val.select && val.select();
        }
    }).then((result) => {
        if (!result.isConfirmed) return;
        const etiq = document.getElementById('swal-etiqueta');
        const val = document.getElementById('swal-valor');
        if (labelEl && etiq) labelEl.textContent = (etiq.value || '').trim() || DEFAULT_LABELS[rowId] || '';
        if (!isTotal && valueEl && val) {
            const n = parseFloat(String(val.value).replace(',', '.'), 10);
            valueEl.value = isNaN(n) ? valueEl.value : n;
        }
        updateDisplays();
        guardarProforma();
        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    });
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
    const m = 15;
    const rightX = m + contentW;
    const verde = [26, 71, 49];
    const dorado = [166, 137, 74];
    const texto = [51, 51, 51];
    const pad = 4;
    const rowH = 8;
    const borderHalf = 0.35 / 2;
    const pageH = 297;
    const bottomMargin = 28;
    const topMargin = 18;
    const maxY = 299;
    let y = 12;

    function checkPage(spaceNeeded) {
        if (y + (spaceNeeded || 0) > maxY) {
            doc.addPage('p', 'mm', 'a4');
            y = topMargin;
            return true;
        }
        return false;
    }

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

    // --- Cabecera: PARQUE ETERNO (izq) y JARDINES DE LA PAZ (der), línea dorada ---
    y += 2;
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...verde);
    doc.text('PARQUE ETERNO S.A.', m, y + 4);
    doc.text('JARDINES DE LA PAZ', rightX, y + 4, { align: 'right' });
    y += 6;
    doc.setDrawColor(...dorado);
    doc.setLineWidth(0.35);
    doc.line(m, y, rightX, y);
    y += 1.5;
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const h = now.getHours();
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    const ampm = h >= 12 ? 'P.M' : 'A.M';
    const h12 = h % 12 || 12;
    const fechaHoraStr = 'fecha: ' + dd + '/' + mm + '/' + yyyy + '  Hora: ' + h12 + ':' + min + ':' + sec + ' ' + ampm;
    doc.text(fechaHoraStr, rightX, y + 1.5, { align: 'right' });
    y += 8;
    doc.setTextColor(...verde);
    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    const codigoStr = (getStr('pro_codigo') || '').trim();
    const tituloPdf = 'PROFORMA : N° ' + (codigoStr || '.........');
    doc.text(tituloPdf, pageW / 2, y, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...texto);
    y += 5;

    // --- Datos / Celular / Dirección (antes de Detalle de costos) ---
    const datosLabel = ['Datos:', 'Dirección:', 'Número celular:'];
    const datosIds = ['pro_datos', 'pro_direccion', 'pro_celular'];
    const datosRowH = 7;
    const datosH = datosRowH * 3 + 2;
    checkPage(datosH + 10);
    doc.setFillColor(248, 250, 248);
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.rect(m, y, contentW, datosH, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(...texto);
    datosLabel.forEach(function (lab, i) {
        const val = getStr(datosIds[i]) || '-';
        const yy = y + 6 + i * datosRowH;
    doc.setFont(undefined, 'bold');
        doc.setTextColor(...verde);
        doc.text(lab, m + pad, yy);
    doc.setFont(undefined, 'normal');
        doc.setTextColor(...texto);
        const labelW = typeof doc.getTextWidth === 'function' ? doc.getTextWidth(lab) : 25;
        const espacioDespuesLabel = 3;
        const valX = m + pad + labelW + espacioDespuesLabel;
        const maxValW = contentW - (valX - m) - pad;
        let valStr = val;
        if (typeof doc.getTextWidth === 'function' && doc.getTextWidth(val) > maxValW && doc.splitTextToSize) {
            valStr = doc.splitTextToSize(val, maxValW)[0] + '…';
        }
        doc.text(valStr, valX, yy);
    });
    y += datosH + 6;

    // --- Tabla: Detalle de costos ---
    const costos = [];
    document.querySelectorAll('.proforma-grid .proforma-grid-row').forEach(function (row) {
        const id = row.getAttribute('data-row-id');
        if (!id) return;
        const label = getLabel(id);
        const val = id === 'pro_total' ? total : getNum(id);
        costos.push([label, val, id === 'pro_total']);
    });
    checkPage(rowH + costos.length * rowH + 15);
    y = drawTableHeader(doc, m, y, contentW, 'DETALLE DE COSTOS');
    costos.forEach(function (item) {
        if (checkPage(rowH)) {
            y = drawTableHeader(doc, m, y, contentW, 'DETALLE DE COSTOS');
        }
        y = drawRow(doc, m, y, contentW, item[0], item[1], item[2]);
    });
    y += 2;

    // --- Total con descuento e Inicial (cajas destacadas, altura reducida) ---
    const boxRowH = 6;
    checkPage(28);
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.setFillColor(248, 250, 248);
    doc.rect(m, y, contentW, boxRowH + 2, 'FD');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...verde);
    doc.text('Total con descuento', m + pad, y + 5);
    doc.text(String(neto) + ' S/', rightX - pad, y + 5, { align: 'right' });
    doc.setFont(undefined, 'normal');
    doc.setTextColor(...texto);
    y += boxRowH + 4;

    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.rect(m, y, contentW, boxRowH + 2, 'S');
    doc.setFont(undefined, 'bold');
    doc.text('Inicial', m + pad, y + 5);
    doc.text(String(getNum('pro_inicial')) + ' S/', rightX - pad, y + 5, { align: 'right' });
    doc.setFont(undefined, 'normal');
    y += boxRowH + 4;

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
    checkPage(saldoBlockH + 5);
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
    checkPage(85);
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
    const nivelRowsDom = [];
    const nivelRowsEl = document.querySelectorAll('#term-nivel-rows .term-nivel-row');
    nivelRowsEl.forEach(function (row) {
        const labelEl = row.querySelector('.term-nivel-label');
        const sel = row.querySelector('.term-nivel-select');
        if (labelEl && sel) nivelRowsDom.push([(labelEl.textContent || '').trim(), sel.value || 'PAGA']);
    });
    const nivelRows = nivelRowsDom;
    const nivelRowH = 5;
    const nivelH = nivelRows.length * nivelRowH;
    let nivelY = termTopY + termTotalH + 3;
    if (nivelRows.length > 0) {
        doc.setDrawColor(...verde);
        doc.setLineWidth(0.35);
        doc.rect(m, nivelY, contentW, nivelH, 'S');
        doc.line(m + contentW / 2, nivelY, m + contentW / 2, nivelY + nivelH);
        for (let i = 1; i < nivelRows.length; i++) {
            doc.line(m, nivelY + i * nivelRowH, m + contentW, nivelY + i * nivelRowH);
    }
    doc.setFontSize(8);
        doc.setTextColor(...verde);
        doc.setFont(undefined, 'bold');
        nivelRows.forEach(function (row, i) {
            const yy = nivelY + (i + 0.5) * nivelRowH + 1.5;
            doc.text(row[0], m + contentW / 4, yy, { align: 'center' });
            doc.text(row[1], m + (contentW * 3) / 4, yy, { align: 'center' });
        });
    doc.setFont(undefined, 'normal');
        doc.setTextColor(...texto);
        nivelY += nivelH;
    } else {
        nivelY -= 3;
    }
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('SE PAGA CUANDO SE USA EL ESPACIO', m, nivelY + 4);
    doc.setTextColor(...texto);
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.line(m, termTopY, m + contentW, termTopY);
    doc.line(m, termTopY + termTotalH, m + contentW, termTopY + termTotalH);
    doc.line(m + borderHalf, termTopY, m + borderHalf, termTopY + termTotalH);
    doc.line(m + contentW, termTopY, m + contentW, termTopY + termTotalH);
    y = nivelY + 9;

    // --- Contacto: solo el título "CONTACTO" con borde un poco a la derecha; el cuadro de abajo (Asesora, Teléfono) igual que los demás ---
    checkPage(45);
    const contactoTitleOffset = 0.18;
    const contactoTitleX = m + contactoTitleOffset;
    const contactoTitleW = contentW - contactoTitleOffset;
    y = drawBoxTitle(doc, contactoTitleX, y, contactoTitleW, 'CONTACTO');
    y += 0.1;
    const contactoH = rowH * 2;
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.35);
    doc.line(m, y, m + contentW, y);
    doc.line(m, y + contactoH, m + contentW, y + contactoH);
    doc.line(m + borderHalf, y, m + borderHalf, y + contactoH);
    doc.line(m + contentW, y, m + contentW, y + contactoH);
    doc.setFontSize(9);
    doc.text('Asesora comercial: ' + getStr('pro_asesora'), m + pad, y + 5);
    doc.text('Teléfono: ' + getStr('pro_telefono'), m + pad, y + 5 + rowH);
    doc.setFont(undefined, 'normal');
    y += contactoH + 5;
    doc.setFontSize(6);
    doc.setTextColor(...verde);
    doc.text('Para sepultura:', m, y);
    doc.text('Oficina: Jr. Pablo de Olavide N° 169-Urb Rázuri', rightX, y, { align: 'right' });
    y += 4;
    doc.text('Teléf. 044-612910/044612911 - Trujillo', rightX, y, { align: 'right' });
    doc.text('-Precio de protección sujeto a la carencia de 30 días.', m, y);
    y += 4;
    doc.setTextColor(...texto);

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
            if (typeof Swal !== 'undefined') {
                Swal.fire({ title: 'Listo', text: 'Formulario limpiado. Se recargará la página.', icon: 'success', confirmButtonColor: VERDE }).then(() => { location.reload(); });
            } else {
                location.reload();
            }
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
    actualizarVisibilidadNivelBox();
    updateDisplays();
    actualizarVisibilidadRestaurarFilas();

    // Número celular: solo 9 dígitos, debe comenzar por 9
    const inputCelular = document.getElementById('pro_celular');
    if (inputCelular) {
        inputCelular.addEventListener('input', function () {
            let val = (this.value || '').replace(/\D/g, '');
            if (val.length > 9) val = val.slice(0, 9);
            if (val.length > 0 && val.charAt(0) !== '9') val = '9' + val.slice(0, 8);
            if (this.value !== val) this.value = val;
        });
        inputCelular.addEventListener('paste', function (e) {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 9);
            if (pasted.length > 0 && pasted.charAt(0) !== '9') this.value = '9' + pasted.slice(0, 8);
            else this.value = pasted;
        });
    }

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

    const btnRestoreRows = document.getElementById('btn-restore-cost-rows');
    if (btnRestoreRows) {
        btnRestoreRows.addEventListener('click', restauraFilasEliminadas);
    }
    const btnAddCostRow = document.getElementById('btn-add-cost-row');
    if (btnAddCostRow) {
        btnAddCostRow.addEventListener('click', function () {
            agregarFilaCosto(getNextExtraCostId(), 'Texto / Valor', '');
        });
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
            if (e.target.closest('.btn-add-nivel')) {
                agregarNivelRow();
                return;
            }
            const btnDeleteNivel = e.target.closest('.btn-delete-nivel');
            if (btnDeleteNivel) {
                const row = btnDeleteNivel.closest('.term-nivel-row');
                if (row) {
                    row.remove();
                    renumerarNivelRows();
                    actualizarVisibilidadNivelBox();
                    guardarProforma();
                    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
                }
                return;
            }
            const btnEdit = e.target.closest('.btn-edit-row');
            if (btnEdit && btnEdit.dataset.row) {
                abrirEditarFila(btnEdit.dataset.row);
                return;
            }
            const btnDeleteCost = e.target.closest('.btn-delete-cost-row');
            if (btnDeleteCost && btnDeleteCost.dataset.row) {
                const rowId = btnDeleteCost.dataset.row;
                if (rowId === 'pro_total') return;
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        title: '¿Eliminar esta fila?',
                        text: 'Se quitará del detalle y el valor se tratará como 0.',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Eliminar',
                        cancelButtonText: 'Cancelar',
                        confirmButtonColor: '#c62828',
                        cancelButtonColor: '#888'
                    }).then(function(res) {
                        if (res.isConfirmed) {
                            const row = document.querySelector('.proforma-grid-row[data-row-id="' + rowId + '"]');
                            if (row) row.remove();
                            updateDisplays();
                            guardarProforma();
                            actualizarVisibilidadRestaurarFilas();
                            if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
                        }
                    });
                } else {
                    const row = document.querySelector('.proforma-grid-row[data-row-id="' + rowId + '"]');
                    if (row && confirm('¿Eliminar esta fila?')) { row.remove(); updateDisplays(); guardarProforma(); }
                }
                return;
            }
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
