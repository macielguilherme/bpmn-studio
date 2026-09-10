/* ============================================================
   BPMN Studio — js/toolbar.js
   Liga os botões [data-action] da toolbar e da statusbar
   às ações do modeler, io e validator.
   ============================================================ */

const state = {
    modeler: null,
    instance: null,
    io: null,
    statusbar: null,
    notifications: null,
    validator: null,
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
    if (!state.instance) return null;
    try {
        return state.instance.get("canvas");
    } catch {
        return null;
    }
}

function applyZoom(targetZoom) {
    const canvas = getCanvas();
    if (!canvas) return;

    const clamped = Math.max(
        state.minZoom,
        Math.min(state.maxZoom, targetZoom)
    );

    canvas.zoom(clamped);
}

function zoomBy(delta) {
    const canvas = getCanvas();
    if (!canvas) return;

    const viewbox = canvas.viewbox();
    const currentZoom = viewbox?.scale ?? 1;

    applyZoom(currentZoom + delta);
}

function zoomFit() {
    const canvas = getCanvas();
    if (!canvas) return;
    canvas.zoom("fit-viewport", "auto");
}

function confirmDiscard() {
    if (!window.BPMNStudio?.state?.hasUnsavedChanges) return true;

    return window.confirm(
        "Você tem alterações não salvas. Deseja realmente descartá-las?"
    );
}

function markSaved() {
    if (window.BPMNStudio?.state) {
        window.BPMNStudio.state.hasUnsavedChanges = false;
    }
    updateSaveState();
}

function updateSaveState() {
    const saveState = document.getElementById("save-state");
    const saveText = document.getElementById("save-state-text");
    if (!saveState || !saveText) return;

    const dirty = window.BPMNStudio?.state?.hasUnsavedChanges;

    saveState.dataset.state = dirty ? "dirty" : "saved";
    saveText.textContent = dirty ? "Não salvo" : "Pronto";
}

// ------------------------------------------------------------
// Handlers
// ------------------------------------------------------------

function handleNew() {
    if (!confirmDiscard()) return;
    if (!state.io?.newDiagram) return;

    state.io.newDiagram();
    markSaved();
    state.statusbar?.setMessage("Novo diagrama criado", { level: "success" });
}

function handleImport() {
    if (!confirmDiscard()) return;

    const fileInput = document.getElementById("file-input");
    if (!fileInput) return;

    fileInput.value = "";
    fileInput.click();
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
            err.message || "O arquivo não é um BPMN válido."
        );
        state.statusbar?.setMessage("Falha ao abrir arquivo", { level: "error" });
    }
}

async function handleExport() {
    if (!state.io?.exportBpmn) return;

    try {
        state.statusbar?.setMessage("Exportando...");
        await state.io.exportBpmn("bpmn");
        markSaved();
        state.statusbar?.setMessage("Exportado com sucesso", {
            level: "success",
            duration: 3000,
        });
    } catch (err) {
        console.error("[BPMN Studio] falha ao exportar:", err);
        state.notifications?.danger(
            "Falha na exportação",
            err.message || "Não foi possível gerar o BPMN."
        );
        state.statusbar?.setMessage("Falha na exportação", { level: "error" });
    }
}

function handleUndo() {
    if (state.modeler?.undo?.()) {
        state.statusbar?.setMessage("Ação desfeita", { level: "info", duration: 2000 });
    }
}

function handleRedo() {
    if (state.modeler?.redo?.()) {
        state.statusbar?.setMessage("Ação refeita", { level: "info", duration: 2000 });
    }
}

function handleValidate() {
    if (!state.validator) return;

    state.validator.toggle();

    // Atualiza statusbar com o resultado
    const summary = state.validator.summarize?.();
    if (summary === "error") {
        state.statusbar?.setMessage("Validação: erros encontrados", {
            level: "error",
            duration: 3000,
        });
    } else if (summary === "warning") {
        state.statusbar?.setMessage("Validação: avisos encontrados", {
            level: "warning",
            duration: 3000,
        });
    } else {
        state.statusbar?.setMessage("Validação: sem problemas", {
            level: "success",
            duration: 3000,
        });
    }
}

function handleReadonly() {
    const next = !state.modeler?.isReadonly?.();
    state.modeler?.setReadonly?.(next);

    const btn = document.getElementById("btn-readonly");
    if (btn) {
        btn.setAttribute("aria-pressed", String(next));
        btn.classList.toggle("is-active", next);
        const label = btn.querySelector(".toolbar-btn__label");
        if (label) label.textContent = next ? "Visualizar" : "Editar";
    }

    state.statusbar?.setMessage(
        next ? "Modo somente leitura" : "Modo de edição",
        { level: "info", duration: 2500 }
    );
}

function handleZoomIn() { zoomBy(state.zoomStep); }
function handleZoomOut() { zoomBy(-state.zoomStep); }
function handleZoomFit() { zoomFit(); }

function handleCloseProperties() {
    const panel = document.getElementById("properties");
    if (panel) panel.classList.toggle("is-closed");
}

function handleCloseValidation() {
    state.validator?.close?.();
}

// ------------------------------------------------------------
// Delegação global
// ------------------------------------------------------------

function onDocumentClick(event) {
    const btn = event.target.closest("[data-action]");
    if (btn) {
        const action = btn.dataset.action;

        switch (action) {
            case "new": return handleNew();
            case "import": return handleImport();
            case "export": return handleExport();
            case "undo": return handleUndo();
            case "redo": return handleRedo();
            case "validate": return handleValidate();
            case "readonly": return handleReadonly();
            case "zoom-in": return handleZoomIn();
            case "zoom-out": return handleZoomOut();
            case "zoom-fit": return handleZoomFit();
            default: return;
        }
    }

    if (event.target.closest("#properties-close")) {
        handleCloseProperties();
        return;
    }

    if (event.target.closest("#validation-close")) {
        handleCloseValidation();
        return;
    }
}

// ------------------------------------------------------------
// Atalhos
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
        event.preventDefault(); handleImport(); return;
    }
    if (ctrl && event.key.toLowerCase() === "s") {
        event.preventDefault(); handleExport(); return;
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
    if (ctrl && event.shiftKey && event.key.toLowerCase() === "v") {
        event.preventDefault(); handleValidate(); return;
    }
    if (event.key.toLowerCase() === "f" && !ctrl && !event.altKey) {
        event.preventDefault(); handleZoomFit(); return;
    }
}

// ------------------------------------------------------------
// Zoom
// ------------------------------------------------------------

function onViewboxChanged(event) {
    const vb = event?.viewbox;
    if (!vb || typeof vb.scale !== "number") return;

    state.currentZoom = vb.scale;
    state.statusbar?.setZoom(vb.scale);
}

// ------------------------------------------------------------
// API
// ------------------------------------------------------------

export function init(options = {}) {
    state.modeler = options.modeler || null;
    state.instance = options.instance || null;
    state.io = options.io || null;
    state.statusbar = options.statusbar || null;
    state.notifications = options.notifications || null;
    state.validator = options.validator || null;

    document.addEventListener("click", onDocumentClick);
    state.listeners.push({ el: document, type: "click", fn: onDocumentClick });

    document.addEventListener("keydown", onKeyDown);
    state.listeners.push({ el: document, type: "keydown", fn: onKeyDown });

    const fileInput = document.getElementById("file-input");
    if (fileInput) {
        fileInput.addEventListener("change", handleFileSelected);
        state.listeners.push({
            el: fileInput,
            type: "change",
            fn: handleFileSelected,
        });
    }

    if (state.instance && typeof state.instance.on === "function") {
        state.instance.on("canvas.viewbox.changed", onViewboxChanged);
        state.listeners.push({
            el: state.instance,
            type: "canvas.viewbox.changed",
            fn: onViewboxChanged,
        });

        try {
            const vb = state.instance.get("canvas").viewbox();
            if (vb?.scale) {
                state.currentZoom = vb.scale;
                state.statusbar?.setZoom(vb.scale);
            }
        } catch {
            // silencioso
        }
    }

    updateSaveState();
    console.info("[BPMN Studio] toolbar inicializada.");
}

export function destroy() {
    for (const { el, type, fn } of state.listeners) {
        try {
            if (el.removeEventListener) el.removeEventListener(type, fn);
            else if (el.off) el.off(type, fn);
        } catch {
            // silencioso
        }
    }
    state.listeners = [];
}
