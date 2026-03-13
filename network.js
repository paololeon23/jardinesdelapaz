// network.js - Reporte QBerries (Actos y/o Condiciones Inseguras)
// Pega aquí la URL de tu Web App de Google (Code.gs)
export const REPORTE_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyRm-mlBVvX6r5eXkNXK-95K1LiaP2aj7AgM7zJurb7bi-nixVWkrTs-fcAiSfkZB7n/exec";

const HISTORIAL_KEY = 'reporte_historial';
const PENDING_KEY = 'reporte_pendientes';

function getPendingReportes() {
    try {
        const raw = localStorage.getItem(PENDING_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
}

function setPendingReportes(arr) {
    try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
        window.dispatchEvent(new CustomEvent('pending-updated'));
    } catch (_) {}
}

function addPendingReporte(payload) {
    const list = getPendingReportes();
    list.push({ payload, addedAt: Date.now() });
    setPendingReportes(list);
}

function removePendingReporteAtIndex(index) {
    const list = getPendingReportes();
    list.splice(index, 1);
    setPendingReportes(list);
}

function getDeviceName() {
    const ua = navigator.userAgent || '';
    if (/Mobile|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
        if (/iPad|Tablet/i.test(ua)) return 'Tablet';
        if (/iPhone|iPod/i.test(ua)) return 'iPhone';
        if (/Android/i.test(ua)) return 'Celular Android';
        return 'Celular';
    }
    if (/Windows/i.test(ua)) return 'PC Windows';
    if (/Mac/i.test(ua)) return 'Mac';
    return 'Equipo';
}

export function getHistorialEntries() {
    try {
        const raw = localStorage.getItem(HISTORIAL_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
}

export function addHistorialEntry() {
    const now = new Date();
    const fechaHora = now.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'medium' });
    const dispositivo = getDeviceName();
    const entries = getHistorialEntries();
    entries.unshift({ fechaHora, dispositivo });
    if (entries.length > 200) entries.pop();
    try {
        localStorage.setItem(HISTORIAL_KEY, JSON.stringify(entries));
        window.dispatchEvent(new CustomEvent('historial-updated'));
    } catch (_) {}
}

// Actualiza el card En línea / Sin conexión y el contador de pendientes
export function updateUI() {
    const statusText = document.getElementById("status-text");
    const statusCard = document.getElementById("network-status-container");
    const countText = document.getElementById("pending-count");
    const pending = getPendingReportes().length;
    if (countText) countText.textContent = "Pendientes: " + pending;

    if (navigator.onLine) {
        if (statusText) statusText.textContent = "En línea";
        if (statusCard) statusCard.className = "status-card-jdp online";
    } else {
        if (statusText) statusText.textContent = "Sin línea";
        if (statusCard) statusCard.className = "status-card-jdp offline";
    }
}

function leerArchivoComoBase64(input) {
    return new Promise(function (resolve) {
        if (!input || !input.files || !input.files[0]) { resolve(''); return; }
        const f = input.files[0];
        const isImage = (f.type || '').toLowerCase().indexOf('image/') === 0;
        if (!isImage) {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = () => resolve('');
            r.readAsDataURL(f);
            return;
        }
        const r = new FileReader();
        r.onload = function () {
            const src = typeof r.result === 'string' ? r.result : '';
            if (!src) { resolve(''); return; }
            const img = new Image();
            img.onload = function () {
                try {
                    // Compresión previa al POST para evitar 413 (payload demasiado grande).
                    const maxSide = 1600;
                    const quality = 0.78;
                    const w = img.naturalWidth || img.width;
                    const h = img.naturalHeight || img.height;
                    if (!w || !h) { resolve(src); return; }
                    const scale = Math.min(1, maxSide / Math.max(w, h));
                    const tw = Math.max(1, Math.round(w * scale));
                    const th = Math.max(1, Math.round(h * scale));
                    const canvas = document.createElement('canvas');
                    canvas.width = tw;
                    canvas.height = th;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { resolve(src); return; }
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, tw, th);
                    ctx.drawImage(img, 0, 0, tw, th);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                } catch (_) {
                    resolve(src);
                }
            };
            img.onerror = function () { resolve(src); };
            img.src = src;
        };
        r.onerror = () => resolve('');
        r.readAsDataURL(f);
    });
}

// Texto por checkbox (lo que se guarda en la celda). Varios seleccionados se unen en UNA celda por grupo.
const CHECKBOX_LABELS = {
    rep_tercero: 'TERCERO', rep_propio: 'PROPIO',
    rep_acto: 'ACTO', rep_condicion: 'CONDICIÓN', rep_incidente: 'INCIDENTE',
    rep_aspecto: 'ASPECTO', rep_impacto: 'IMPACTO',
    rep_causa_orden: 'Orden y Limpieza', rep_causa_herramientas: 'Herramientas, Materiales y Equipos',
    rep_causa_ergonomia: 'Ergonomía', rep_causa_productos: 'Productos Peligrosos',
    rep_causa_residuos: 'Segregación de residuos', rep_causa_analisis: 'Análisis de tareas',
    rep_causa_epp: 'Equipo de Protección Personal', rep_causa_conduccion: 'Conducción de vehículos',
    rep_causa_infra: 'Infraestructura', rep_causa_ambiental: 'Práctica Ambiental Inadecuada',
    rep_causa_otros: 'Otros'
};

function getCheckedLabels(ids) {
    return ids
        .map(id => {
            const el = document.getElementById(id);
            return (el && el.checked && CHECKBOX_LABELS[id]) ? CHECKBOX_LABELS[id] : null;
        })
        .filter(Boolean)
        .join(', ');
}

function buildPayloadReporte() {
    const data = {};
    ['rep_codigo', 'rep_version', 'rep_aprobacion', 'rep_area', 'rep_fecha', 'rep_lugar', 'rep_persona', 'rep_descripcion', 'rep_accion', 'rep_recomendacion', 'rep_reportante', 'rep_firma'].forEach(id => {
        const el = document.getElementById(id);
        if (el) data[id] = (el.value || '').toString().trim();
    });
    ['rep_foto_nombre_descripcion', 'rep_foto_nombre_accion', 'rep_foto_nombre_recomendacion'].forEach(id => {
        const el = document.getElementById(id);
        if (el) data[id] = (el.value || '').toString().trim();
    });
    data.rep_origen = getCheckedLabels(['rep_tercero', 'rep_propio']);
    data.rep_clasificacion_seguridad = getCheckedLabels(['rep_acto', 'rep_condicion', 'rep_incidente']);
    data.rep_medio_ambiente = getCheckedLabels(['rep_aspecto', 'rep_impacto']);
    data.rep_causa = getCheckedLabels([
        'rep_causa_orden', 'rep_causa_herramientas', 'rep_causa_ergonomia', 'rep_causa_productos', 'rep_causa_residuos',
        'rep_causa_analisis', 'rep_causa_epp', 'rep_causa_conduccion', 'rep_causa_infra', 'rep_causa_ambiental', 'rep_causa_otros'
    ]);
    data.envio_con_inter = navigator.onLine;
    return data;
}

export function initReporteForm() {
    const form = document.getElementById('seguridad-form');
    const btn = document.getElementById('btn-guardar-registro');
    if (!form || !form.classList.contains('reporte-qberries') || !btn) return;

    var fechaInput = document.getElementById('rep_fecha');
    var fechaDisplay = document.getElementById('rep_fecha_display');
    var fechaWrap = fechaInput && fechaInput.closest('.rep-fecha-wrap');
    var meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    function actualizarDisplayFecha() {
        if (!fechaInput || !fechaDisplay || !fechaWrap) return;
        var v = (fechaInput.value || '').trim();
        if (!v) {
            fechaDisplay.textContent = 'dd/mm/aaaa';
            fechaWrap.classList.remove('has-value');
            return;
        }
        var parts = v.split('-');
        if (parts.length !== 3) { fechaDisplay.textContent = 'dd/mm/aaaa'; fechaWrap.classList.remove('has-value'); return; }
        var d = parseInt(parts[2], 10);
        var m = parseInt(parts[1], 10) - 1;
        var y = parts[0];
        if (m >= 0 && m < 12) {
            fechaDisplay.textContent = d + ' ' + meses[m] + '. ' + y;
            fechaWrap.classList.add('has-value');
        } else {
            fechaDisplay.textContent = v;
            fechaWrap.classList.add('has-value');
        }
    }
    if (fechaInput && !fechaInput.value) {
        fechaInput.value = new Date().toISOString().slice(0, 10);
    }
    actualizarDisplayFecha();
    if (fechaInput) {
        fechaInput.addEventListener('change', actualizarDisplayFecha);
        fechaInput.addEventListener('input', actualizarDisplayFecha);
    }
    var fechaLabel = fechaWrap && fechaWrap.querySelector('.rep-fecha-icon-wrap');
    if (fechaLabel && fechaInput) {
        fechaLabel.addEventListener('click', function () {
            if (typeof fechaInput.showPicker === 'function') {
                try { fechaInput.showPicker(); } catch (_) {}
            }
        });
    }

    const fotoNombreIds = ['rep_foto_nombre_descripcion', 'rep_foto_nombre_accion', 'rep_foto_nombre_recomendacion'];
    const fileInputIds = ['rep_foto_descripcion', 'rep_foto_accion', 'rep_foto_recomendacion'];
    for (let i = 0; i < fileInputIds.length; i++) {
        const fileInput = document.getElementById(fileInputIds[i]);
        const nombreInput = document.getElementById(fotoNombreIds[i]);
        if (!fileInput || !nombreInput) continue;
        fileInput.addEventListener('change', function () {
            if (nombreInput.dataset.fotoUrl) URL.revokeObjectURL(nombreInput.dataset.fotoUrl);
            if (this.files && this.files[0]) {
                nombreInput.value = this.files[0].name;
                nombreInput.dataset.fotoUrl = URL.createObjectURL(this.files[0]);
            } else {
                nombreInput.value = '';
                delete nombreInput.dataset.fotoUrl;
            }
        });
        nombreInput.addEventListener('click', function () {
            const url = this.dataset.fotoUrl;
            if (!url) return;
            const modal = document.getElementById('modal-foto-ver');
            const img = document.getElementById('modal-foto-img');
            if (modal && img) { img.src = url; modal.classList.add('modal-foto-abierto'); modal.setAttribute('aria-hidden', 'false'); }
        });
    }

    const modal = document.getElementById('modal-foto-ver');
    const img = document.getElementById('modal-foto-img');
    function cerrarModal() {
        if (!modal) return;
        modal.classList.remove('modal-foto-abierto');
        modal.setAttribute('aria-hidden', 'true');
        if (img) img.src = '';
    }
    if (modal) {
        modal.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });
        const btnCerrar = modal.querySelector('.modal-foto-cerrar');
        if (btnCerrar) btnCerrar.addEventListener('click', cerrarModal);
    }

    function limpiarFotos() {
        fotoNombreIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.dataset.fotoUrl) URL.revokeObjectURL(el.dataset.fotoUrl);
                el.value = '';
                delete el.dataset.fotoUrl;
            }
        });
    }
    function setFechaHoy() {
        var el = document.getElementById('rep_fecha');
        if (el) {
            el.value = new Date().toISOString().slice(0, 10);
            if (typeof actualizarDisplayFecha === 'function') actualizarDisplayFecha();
        }
    }

    btn.addEventListener('click', function () {
        if (!form.checkValidity()) { form.reportValidity(); return; }
        if (!REPORTE_WEB_APP_URL) {
            if (typeof Swal !== 'undefined') Swal.fire({ title: 'Configurar', text: 'Configura REPORTE_WEB_APP_URL en network.js', icon: 'info', confirmButtonColor: '#27ae60' });
            else alert('Configura REPORTE_WEB_APP_URL en network.js');
            return;
        }
        const payload = buildPayloadReporte();
        let payloadConFotos = null;
        const btnText = btn.querySelector('.btn-guardar-text');
        const spinner = document.getElementById('spinner_guardar');
        const hasSwal = typeof Swal !== 'undefined';
        let alertaGuardarTimer = null;
        let alertaGuardarAbierta = false;
        function abrirAlertaGuardando() {
            if (!hasSwal) return;
            alertaGuardarTimer = setTimeout(() => {
                const focusedEl = document.activeElement;
                if (focusedEl && typeof focusedEl.blur === 'function') focusedEl.blur();
                Swal.fire({
                    title: 'Espere un momento',
                    text: 'Se esta guardando la informacion...',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false,
                    didOpen: () => {
                        alertaGuardarAbierta = true;
                        Swal.showLoading();
                    },
                    willClose: () => { alertaGuardarAbierta = false; }
                });
            }, 450);
        }
        function cerrarAlertaGuardando() {
            if (!hasSwal) return;
            if (alertaGuardarTimer) {
                clearTimeout(alertaGuardarTimer);
                alertaGuardarTimer = null;
            }
            if (alertaGuardarAbierta && Swal.isVisible()) Swal.close();
        }
        btn.disabled = true;
        btnText.textContent = 'Enviando...';
        if (spinner) spinner.style.display = 'inline-block';
        abrirAlertaGuardando();
        Promise.all([
            leerArchivoComoBase64(document.getElementById('rep_foto_descripcion')),
            leerArchivoComoBase64(document.getElementById('rep_foto_accion')),
            leerArchivoComoBase64(document.getElementById('rep_foto_recomendacion'))
        ]).then(arr => {
            if (arr[0]) payload.rep_foto_descripcion_base64 = arr[0];
            if (arr[1]) payload.rep_foto_accion_base64 = arr[1];
            if (arr[2]) payload.rep_foto_recomendacion_base64 = arr[2];
            payloadConFotos = { ...payload };
            if (!navigator.onLine) {
                addPendingReporte(payload);
                updateUI();
                btn.disabled = false;
                btnText.textContent = 'GUARDAR REPORTE';
                if (spinner) spinner.style.display = 'none';
                cerrarAlertaGuardando();
                if (typeof Swal !== 'undefined') Swal.fire({ title: 'Guardado localmente', text: 'Se enviará cuando haya conexión. Revisa "Pendientes" en el encabezado.', icon: 'success', confirmButtonColor: '#27ae60' });
                else alert('Guardado localmente. Se enviará cuando haya conexión.');
                form.reset();
                limpiarFotos();
                setFechaHoy();
                return Promise.resolve({ offline: true });
            }
            return fetch(REPORTE_WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                body: JSON.stringify(payload)
            });
        }).then((resp) => {
            btn.disabled = false;
            btnText.textContent = 'GUARDAR REPORTE';
            if (spinner) spinner.style.display = 'none';
            if (resp && resp.offline) return;
            cerrarAlertaGuardando();
            addHistorialEntry();
            if (typeof Swal !== 'undefined') Swal.fire({ title: 'Guardado', text: 'Reporte y fotos enviados correctamente.', icon: 'success', confirmButtonColor: '#27ae60' });
            else alert('Reporte enviado correctamente.');
            form.reset();
            limpiarFotos();
            setFechaHoy();
        }).catch(() => {
            btn.disabled = false;
            btnText.textContent = 'GUARDAR REPORTE';
            if (spinner) spinner.style.display = 'none';
            cerrarAlertaGuardando();
            addPendingReporte(payloadConFotos || buildPayloadReporte());
            updateUI();
            if (typeof Swal !== 'undefined') Swal.fire({ title: 'Guardado localmente', text: 'No hay conexión. El reporte quedó pendiente y se enviará cuando haya internet.', icon: 'success', confirmButtonColor: '#27ae60' });
            else alert('Guardado localmente. Se enviará cuando haya conexión.');
            form.reset();
            limpiarFotos();
            setFechaHoy();
        });
    });

}

/** Envía los reportes pendientes cuando hay conexión (se llama al volver online) */
export async function enviarPendientes() {
    if (!navigator.onLine) return;
    const list = getPendingReportes();
    if (list.length === 0) return;
    for (let i = list.length - 1; i >= 0; i--) {
        const { payload } = list[i];
        try {
            await fetch(REPORTE_WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                body: JSON.stringify(payload)
            });
            removePendingReporteAtIndex(i);
            addHistorialEntry();
            updateUI();
        } catch (_) {
            break;
        }
    }
    updateUI();
}
