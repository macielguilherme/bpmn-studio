/* ============================================================
   BPMN Studio — js/modeler.js
   Instancia e gerencia o bpmn-js. Coração do app.
   ============================================================ */

const state = {
    instance: null,
    container: null,
    statusbar: null,
    notifications: null,
    readonly: false,
    listeners: [],
};

// ------------------------------------------------------------
// Inicialização
// ------------------------------------------------------------

export function init(options = {}) {
    if (state.instance) {
        console.warn("[BPMN Studio] modeler.init() chamado mais de uma vez.");
        return state.instance;
    }

    if (typeof window.BpmnJS !== "function") {
        throw new Error(
            "BpmnJS não disponível. Verifique se o CDN carregou."
        );
    }

    const container =
        typeof options.container === "string"
            ? document.querySelector(options.container)
            : options.container;

    if (!container) {
        throw new Error("Container do canvas não encontrado.");
    }

    state.container = container;
    state.statusbar = options.statusbar || null;
    state.notifications = options.notifications || null;
    state.readonly = !!options.readonly;

    state.instance = new window.BpmnJS({
        container,
        keyboard: { bindTo: document },
    });

    attachZoomListener();

    console.info("[BPMN Studio] bpmn-js inicializado com sucesso.");
    return state.instance;
}

function attachZoomListener() {
    if (!state.instance) return;

    const handler = (event) => {
        const vb = event?.viewbox;
        if (!vb || typeof vb.scale !== "number") return;

        state.statusbar?.setZoom?.(vb.scale);
        state.notifications?.noop?.();
    };

    state.instance.on("canvas.viewbox.changed", handler);
    state.listeners.push({ event: "canvas.viewbox.changed", handler });
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

export function getInstance() {
    return state.instance;
}

export function isReady() {
    return !!state.instance;
}

export function on(event, handler) {
    if (!state.instance) return;
    state.instance.on(event, handler);
}

export function off(event, handler) {
    if (!state.instance) return;
    state.instance.off(event, handler);
}

export async function importXML(xml) {
    if (!state.instance) throw new Error("Modeler não inicializado.");
    if (typeof xml !== "string" || !xml.trim()) {
        throw new Error("XML vazio.");
    }
    return state.instance.importXML(xml);
}

export async function exportXML(options = {}) {
    if (!state.instance) throw new Error("Modeler não inicializado.");

    const result = await state.instance.saveXML({
        format: options.format !== false,
    });
    return result?.xml || "";
}

export async function exportSVG() {
    if (!state.instance) throw new Error("Modeler não inicializado.");

    const result = await state.instance.saveSVG();
    return result?.svg || "";
}

export function getZoom() {
    if (!state.instance) return 1;

    try {
        const canvas = state.instance.get("canvas");
        const vb = canvas.viewbox();
        return vb?.scale ?? 1;
    } catch {
        return 1;
    }
}

export function setZoom(value) {
    if (!state.instance) return;

    try {
        const canvas = state.instance.get("canvas");
        canvas.zoom(value);
    } catch (err) {
        console.warn("[BPMN Studio] erro ao aplicar zoom:", err);
    }
}

export function fitViewport() {
    if (!state.instance) return;

    try {
        const canvas = state.instance.get("canvas");
        canvas.zoom("fit-viewport", "auto");
    } catch (err) {
        console.warn("[BPMN Studio] erro no fit:", err);
    }
}

export function undo() {
    if (!state.instance || state.readonly) return false;

    try {
        const stack = state.instance.get("commandStack");
        if (!stack.canUndo()) return false;
        stack.undo();
        return true;
    } catch {
        return false;
    }
}

export function redo() {
    if (!state.instance || state.readonly) return false;

    try {
        const stack = state.instance.get("commandStack");
        if (!stack.canRedo()) return false;
        stack.redo();
        return true;
    } catch {
        return false;
    }
}

export function canUndo() {
    if (!state.instance) return false;

    try {
        return state.instance.get("commandStack").canUndo();
    } catch {
        return false;
    }
}

export function canRedo() {
    if (!state.instance) return false;

    try {
        return state.instance.get("commandStack").canRedo();
    } catch {
        return false;
    }
}

export function setReadonly(flag) {
    state.readonly = !!flag;

    if (state.container) {
        state.container.classList.toggle(
            "bpmn-studio-readonly",
            state.readonly
        );
    }
}

export function isReadonly() {
    return state.readonly;
}

export function getElementCount() {
    if (!state.instance) return 0;

    try {
        const registry = state.instance.get("elementRegistry");
        return registry.getAll().filter((el) => !el.labelTarget).length;
    } catch {
        return 0;
    }
}

export function destroy() {
    if (!state.instance) return;

    for (const { event, handler } of state.listeners) {
        try {
            state.instance.off(event, handler);
        } catch {
            // silencioso
        }
    }
    state.listeners = [];

    try {
        state.instance.destroy();
    } catch {
        // silencioso
    }

    state.instance = null;
    state.container = null;
}