/* ============================================================
   BPMN Studio — js/editor/modeler.js
   Instancia e gerencia o bpmn-js. Coração do app.
   ============================================================ */

// ------------------------------------------------------------
// Estado do módulo (singleton)
// ------------------------------------------------------------
const state = {
    instance: null,
    canvasEl: null,
    statusbar: null,
    readonly: false,
    initializing: false,
    listeners: [],
};

// ------------------------------------------------------------
// Configuração do bpmn-js
// ------------------------------------------------------------
const MODELER_OPTIONS = {
    // Onde o bpmn-js injeta o canvas (definido em init())
    container: null,

    // Ativa o teclado (atalhos internos da lib: Ctrl+Z, Delete, etc.)
    keyboard: {
        bindTo: document,
    },

    // Configura o "additionalModules" — deixamos vazio por padrão,
    // pois queremos o comportamento padrão do bpmn-js.
    // Futuramente podemos injetar módulos customizados aqui.
    additionalModules: [],

    // Configura a paleta (a lateral esquerda do bpmn-js, não a nossa sidebar).
    // Deixamos ativa — é útil para o usuário, mesmo tendo a nossa sidebar.
    // Se um dia quiser esconder, mude para: palette: { enabled: false }
};

// ------------------------------------------------------------
// Inicialização
// ------------------------------------------------------------

/**
 * Cria a instância do bpmn-js no elemento indicado.
 * Deve ser chamado UMA vez no boot.
 *
 * @param {HTMLElement} canvasEl - elemento onde o bpmn-js vai renderizar
 * @param {object} [options]
 * @param {object} [options.statusbar] - módulo statusbar (para sync de zoom)
 * @param {boolean} [options.readonly=false] - modo somente leitura
 * @returns {object} instância do bpmn-js
 */
export function init(canvasEl, options = {}) {
    if (state.instance) {
        console.warn("[BPMN Studio] modeler.init() chamado mais de uma vez. Ignorando.");
        return state.instance;
    }

    // 1) Valida o elemento
    if (!canvasEl || !(canvasEl instanceof HTMLElement)) {
        throw new Error(
            "Elemento do canvas inválido. Verifique se #canvas existe no HTML."
        );
    }

    // 2) Valida a lib
    if (typeof window.BpmnJS !== "function") {
        throw new Error(
            "BpmnJS não está disponível. O CDN pode ter falhado ao carregar."
        );
    }

    state.canvasEl = canvasEl;
    state.statusbar = options.statusbar || null;
    state.readonly = !!options.readonly;
    state.initializing = true;

    // 3) Instancia
    try {
        const opts = {
            ...MODELER_OPTIONS,
            container: canvasEl,
        };

        state.instance = new window.BpmnJS(opts);
    } catch (err) {
        state.initializing = false;
        console.error("[BPMN Studio] falha ao criar instância do bpmn-js:", err);
        throw new Error(
            "Não foi possível inicializar o editor BPMN. " +
            (err?.message || "")
        );
    }

    // 4) Configura listeners globais
    attachCanvasZoomListener();
    attachLifecycleListeners();

    // 5) Modo readonly (opcional)
    if (state.readonly) {
        applyReadonly();
    }

    state.initializing = false;

    console.info("[BPMN Studio] bpmn-js inicializado com sucesso.");
    return state.instance;
}

// ------------------------------------------------------------
// Listeners internos
// ------------------------------------------------------------

/**
 * Sincroniza o zoom exibido na statusbar com o zoom real do canvas.
 */
function attachCanvasZoomListener() {
    if (!state.instance || !state.statusbar) return;

    const handler = (event) => {
        const vb = event?.viewbox;
        if (!vb || typeof vb.scale !== "number") return;
        state.statusbar.setZoom(vb.scale);
    };

    state.instance.on("canvas.viewbox.changed", handler);
    state.listeners.push({ event: "canvas.viewbox.changed", handler });
}

/**
 * Listeners de ciclo de vida úteis para debug e para estado global.
 */
function attachLifecycleListeners() {
    if (!state.instance) return;

    // Import concluído — emite log e atualiza estado global
    const onImportDone = (event) => {
        const warnings = event?.warnings || [];
        if (warnings.length > 0) {
            console.warn(
                `[BPMN Studio] import concluído com ${warnings.length} aviso(s).`,
                warnings
            );
        }
    };

    state.instance.on("import.done", onImportDone);
    state.listeners.push({ event: "import.done", handler: onImportDone });
}

/**
 * Aplica modo somente-leitura.
 * Desabilita modeling, palette, contextPad e teclado.
 */
function applyReadonly() {
    if (!state.instance) return;

    try {
        // Tenta desligar módulos que permitem edição
        const modules = [
            "modeling",
            "palette",
            "contextPad",
            "keyboard",
            "move",
            "spaceTool",
            "lassoTool",
            "handTool",
        ];

        for (const name of modules) {
            try {
                const mod = state.instance.get(name);
                if (mod && typeof mod.toggle === "function") {
                    mod.toggle(false);
                } else if (mod && typeof mod.disable === "function") {
                    mod.disable();
                }
            } catch (err) {
                // módulo pode não existir — silencioso
            }
        }

        // Bloqueia edição de labels via CSS
        if (state.canvasEl) {
            state.canvasEl.classList.add("bpmn-readonly");
        }

        console.info("[BPMN Studio] modeler em modo somente-leitura.");
    } catch (err) {
        console.warn("[BPMN Studio] falha ao aplicar readonly:", err);
    }
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

/**
 * Retorna a instância do bpmn-js (ou null se não inicializada).
 */
export function getInstance() {
    return state.instance;
}

/**
 * Verifica se o modeler está pronto.
 */
export function isReady() {
    return !!state.instance && !state.initializing;
}

/**
 * Registra um listener de evento do bpmn-js.
 * Espelha a API do bpmn-js (on/off) para conveniência.
 */
export function on(event, handler) {
    if (!state.instance) {
        console.warn(`[BPMN Studio] on("${event}") chamado antes de init().`);
        return;
    }
    state.instance.on(event, handler);
}

/**
 * Remove um listener registrado via on().
 */
export function off(event, handler) {
    if (!state.instance) return;
    state.instance.off(event, handler);
}

/**
 * Importa XML BPMN no modeler.
 * Retorna { warnings } — a lib do bpmn-js.
 *
 * @param {string} xml
 * @returns {Promise<{warnings: Array}>}
 */
export async function importXML(xml) {
    if (!state.instance) {
        throw new Error("Modeler não inicializado.");
    }
    if (typeof xml !== "string" || xml.trim().length === 0) {
        throw new Error("XML vazio ou inválido.");
    }
    return state.instance.importXML(xml);
}

/**
 * Exporta o diagrama atual como XML BPMN 2.0.
 *
 * @param {object} [options]
 * @param {boolean} [options.format=true] - XML indentado
 * @returns {Promise<string>}
 */
export async function exportXML(options = {}) {
    if (!state.instance) {
        throw new Error("Modeler não inicializado.");
    }
    const result = await state.instance.saveXML({
        format: options.format !== false,
    });
    return result?.xml || "";
}

/**
 * Salva o SVG do diagrama atual (útil para exportar imagem no futuro).
 */
export async function exportSVG() {
    if (!state.instance) {
        throw new Error("Modeler não inicializado.");
    }
    const result = await state.instance.saveSVG();
    return result?.svg || "";
}

/**
 * Destroi a instância do bpmn-js e limpa o canvas.
 * Útil para hot-reload e testes.
 */
export function destroy() {
    if (!state.instance) return;

    // Remove listeners registrados
    for (const { event, handler } of state.listeners) {
        try {
            state.instance.off(event, handler);
        } catch (err) {
            // silencioso
        }
    }
    state.listeners = [];

    // Destroi a instância
    try {
        state.instance.destroy();
    } catch (err) {
        console.warn("[BPMN Studio] erro ao destruir modeler:", err);
    }

    state.instance = null;
    state.canvasEl = null;
    state.statusbar = null;
    state.readonly = false;
    state.initializing = false;

    console.info("[BPMN Studio] modeler destruído.");
}

/**
 * Ativa ou desativa modo readonly em runtime.
 */
export function setReadonly(flag) {
    state.readonly = !!flag;
    if (state.readonly) {
        applyReadonly();
    } else {
        // Recarrega os módulos desabilitados
        const modules = ["modeling", "palette", "contextPad", "keyboard"];
        for (const name of modules) {
            try {
                const mod = state.instance?.get(name);
                if (mod && typeof mod.toggle === "function") {
                    mod.toggle(true);
                }
            } catch (err) {
                // silencioso
            }
        }
        state.canvasEl?.classList.remove("bpmn-readonly");
    }
}

/**
 * Retorna se está em modo readonly.
 */
export function isReadonly() {
    return state.readonly;
}