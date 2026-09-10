/* ============================================================
   BPMN Studio — js/ui/toolbar.js
   Liga botões da toolbar e da statusbar às ações do modeler e do io.
   Usa delegação de eventos no document para capturar botões
   em qualquer parte da página.
   ============================================================ */

const state = {
    dom: null,
    modeler: null,
    io: null,
    statusbar: null,
    notifications: null,
    listeners: [],
    currentZoom: 1.0,
    zoomStep: 0.1,
    minZoom: 0.2,
    maxZoom: 4.0,
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function getCanvas() {
    if (!state.modeler) return null;
    try {
        return state.modeler.get("canvas");
    } catch (err) {
        console.warn("[BPMN Studio] canvas indisponível:", err);
        return null;
    }
}

function applyZoom(targetZoom) {
    const canvas = getCanvas();
    if (!canvas) return;

    const clamped = Math.max(state.minZoom, Math.min(state.maxZoom, targetZoom));
    canvas.zoom(clamped);
    state.currentZoom = clamped;
}

function zoomBy(delta) {
    applyZoom(state.currentZoom + delta);
}

function zoomFit() {
    const canvas = getCanvas();
    if (!canvas) return;
    canvas.zoom("fit-viewport", "auto");
}

function confirmDiscard() {
    if (!window.BPMNStudio?.state?.hasUnsavedChanges) {
        return true;
    }
    return window.confirm(
        "Você tem alterações não salvas. Deseja realmente descartá-las?"
    );
}

function markSaved() {
    if (window.BPMNStudio?.state) {
        window.BPMNStudio.state.hasUnsavedChanges = false;
    }
    if (state.statusbar) {
        state.statusbar.clearMessage();
    }
}

// ------------------------------------------------------------
// Handlers de ação
// ------------------------------------------------------------

function handleNew() {
    if (!confirmDiscard()) return;
    if (!state.io?.newDiagram) return;
    state.io.newDiagram();
    markSaved();
    state.statusbar?.setMessage("Novo diagrama criado");
}

function handleOpen() {
    if (!confirmDiscard()) return;
    if (!state.dom?.fileInput) return;
    state.dom.fileInput.value = "";
    state.dom.fileInput.click();
}

async function handleFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!state.io?.importBpmn) return;

    try {
        state.statusbar?.setMessage(`Abrindo "${file.name}"...`);
        await state.io.importBpmn(file);
        markSaved();
        state.statusbar?.setMessage(`Aberto: ${file.name}`, {
            level: "success",
            duration: 3000,
        });
    } catch (err) {
        console.error("[BPMN Studio] falha ao importar:", err);
        state.notifications?.danger(
            "Falha ao abrir arquivo",
            err.message || "O arquivo pode estar corrompido ou não é um BPMN válido."
        );
        state.statusbar?.setMessage("Falha ao abrir arquivo", { level: "error" });
    }
}

async function handleSave() {
    return handleExport("bpmn");
}

async function handleExport(format) {
    if (!state.io?.exportBpmn) return;

    try {
        state.statusbar?.setMessage("Exportando...");
        await state.io.exportBpmn(format);
        markSaved();
        state.statusbar?.setMessage("Exportado com sucesso", {
            level: "success",
            duration: 3000,
        });
    } catch (err) {
        console.error("[BPMN Studio] falha ao exportar:", err);
        state.notifications?.danger(
            "Falha na exportação",
            err.message || "Não foi possível gerar o arquivo BPMN."
        );
        state.statusbar?.setMessage("Falha na exportação", { level: "error" });
    }
}

function handleZoomIn() { zoomBy(state.zoomStep); }
function handleZoomOut() { zoomBy(-state.zoomStep); }
function handleZoomFit() { zoomFit(); }

// ------------------------------------------------------------
// Delegação de eventos — 1 listener no document
// ------------------------------------------------------------

function onDocumentClick(event) {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;

    switch (action) {
        // Toolbar
        case "new":    return handleNew();
        case "open":   return handleOpen();
        case "save":   return handleSave();
        case "export": return handleExport("bpmn");

        // Statusbar
        case "zoom-in":  return handleZoomIn();
        case "zoom-out": return handleZoomOut();
        case "zoom-fit": return handleZoomFit();

        // Validação
        case "close-validation":
            window.BPMNStudio?.validator?.close?.();
            return;

        default:
            return;
    }
}

// ------------------------------------------------------------
// Atalhos de teclado
// ------------------------------------------------------------

function onKeyDown(event) {
    const tag = document.activeElement?.tagName;
    if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        document.activeElement?.isContentEditable
    ) {
        return;
    }

    const ctrl = event.ctrlKey || event.metaKey;

    if (ctrl && event.key.toLowerCase() === "n") {
        event.preventDefault(); handleNew(); return;
    }
    if (ctrl && event.key.toLowerCase() === "o") {
        event.preventDefault(); handleOpen(); return;
    }
    if (ctrl && event.key.toLowerCase() === "s") {
        event.preventDefault(); handleSave(); return;
    }
    if (ctrl && (event.key === "=" || event.key === "+")) {
        event.preventDefault(); handleZoomIn(); return;
    }
    if (ctrl && event.key === "-") {
        event.preventDefault(); handleZoomOut(); return;
    }
    if (ctrl && event.key === "0") {
        event.preventDefault(); handleZoomFit(); return;
    }
}

// ------------------------------------------------------------
// Sincronização do zoom com a statusbar
// ------------------------------------------------------------

function onViewboxChanged(event) {
    const vb = event?.viewbox;
    if (!vb || typeof vb.scale !== "number") return;

    state.currentZoom = vb.scale;
    state.statusbar?.setZoom(vb.scale);
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

export function init(options = {}) {
    state.dom = options.dom || null;
    state.modeler = options.modeler || null;
    state.io = options.io || null;
    state.statusbar = options.statusbar || null;
    state.notifications = options.notifications || null;

    // UM listener no document captura cliques em qualquer [data-action]
    document.addEventListener("click", onDocumentClick);
    state.listeners.push({ el: document, type: "click", fn: onDocumentClick });

    // File input
    if (state.dom?.fileInput) {
        state.dom.fileInput.addEventListener("change", handleFileSelected);
        state.listeners.push({
            el: state.dom.fileInput,
            type: "change",
            fn: handleFileSelected,
        });
    }

    // Atalhos de teclado
    document.addEventListener("keydown", onKeyDown);
    state.listeners.push({ el: document, type: "keydown", fn: onKeyDown });

    // Sincronização de zoom
    if (state.modeler && typeof state.modeler.on === "function") {
        state.modeler.on("canvas.viewbox.changed", onViewboxChanged);
        state.listeners.push({
            el: state.modeler,
            type: "canvas.viewbox.changed",
            fn: onViewboxChanged,
        });

        // Inicializa estado de zoom a partir do viewbox atual
        try {
            const canvas = state.modeler.get("canvas");
            const vb = canvas.viewbox();
            if (vb && typeof vb.scale === "number") {
                state.currentZoom = vb.scale;
                state.statusbar?.setZoom(vb.scale);
            }
        } catch (err) {
            // silencioso
        }
    }
}

export function destroy() {
    for (const { el, type, fn } of state.listeners) {
        if (!el) continue;
        if (el.removeEventListener) {
            el.removeEventListener(type, fn);
        } else if (el.off) {
            el.off(type, fn);
        }
    }
    state.listeners = [];
}