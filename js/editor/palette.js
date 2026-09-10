/* ============================================================
   BPMN Studio — js/editor/palette.js
   Conecta a sidebar HTML (.sidebar__list) ao canvas do bpmn-js.
   Suporta drag-and-drop E click-to-create.
   ============================================================ */

// ------------------------------------------------------------
// Estado do módulo (singleton)
// ------------------------------------------------------------
const state = {
    modeler: null,
    elementFactory: null,
    modeling: null,
    canvas: null,
    listeners: [],
    dragging: null,       // { bpmnType }
    clickOffset: 0,       // offset em cascata para click-to-create
};

// ------------------------------------------------------------
// Helpers internos
// ------------------------------------------------------------

/**
 * Resolve os serviços do bpmn-js de forma defensiva.
 * Retorna null se algum serviço essencial não existir.
 */
function resolveServices(modeler) {
    try {
        return {
            elementFactory: modeler.get("elementFactory"),
            modeling: modeler.get("modeling"),
            canvas: modeler.get("canvas"),
        };
    } catch (err) {
        console.warn("[BPMN Studio] serviços do bpmn-js indisponíveis:", err);
        return null;
    }
}

/**
 * Retorna o rootElement atual (processo/collaboration).
 */
function getRootElement() {
    if (!state.canvas) return null;
    try {
        return state.canvas.getRootElement();
    } catch (err) {
        return null;
    }
}

/**
 * Converte coordenadas de tela para coordenadas do modelo BPMN.
 * Leva em conta pan (x, y) e zoom (scale).
 */
function screenToModel(clientX, clientY) {
    if (!state.canvas) return { x: 0, y: 0 };
    try {
        const vb = state.canvas.viewbox();
        // O viewbox do bpmn-js:
        //   vb.x, vb.y    → canto superior esquerdo do viewport em coords de modelo
        //   vb.scale      → zoom
        //   vb.width, vb.height → dimensões do viewport em coords de modelo
        //
        // O cliente X,Y é relativo à janela. Precisamos subtrair a posição
        // do container do canvas na tela.
        const canvasEl = document.querySelector(".canvas-wrap");
        const rect = canvasEl ? canvasEl.getBoundingClientRect() : { left: 0, top: 0 };

        const relX = clientX - rect.left;
        const relY = clientY - rect.top;

        return {
            x: vb.x + relX / vb.scale,
            y: vb.y + relY / vb.scale,
        };
    } catch (err) {
        return { x: clientX, y: clientY };
    }
}

/**
 * Detecta se o tipo é um flow/conector.
 * Flows NÃO são criados por drag-and-drop — só entre elementos.
 */
function isFlowType(bpmnType) {
    return (
        bpmnType === "bpmn:SequenceFlow" ||
        bpmnType === "bpmn:MessageFlow" ||
        bpmnType === "bpmn:Association"
    );
}

/**
 * Detecta se o tipo exige ser filho de uma pool/participant.
 * Lane e DataObject só fazem sentido dentro de contexto.
 * Por enquanto criamos direto — o bpmn-js lida com isso.
 */
function needsParentContext(bpmnType) {
    return (
        bpmnType === "bpmn:Lane" ||
        bpmnType === "bpmn:DataObjectReference" ||
        bpmnType === "bpmn:DataStoreReference"
    );
}

/**
 * Cria um elemento BPMN no canvas.
 *
 * @param {string} bpmnType - ex.: "bpmn:Task"
 * @param {number} x - coordenada do modelo (centro)
 * @param {number} y - coordenada do modelo (centro)
 * @returns {object|null} elemento criado ou null
 */
function createElement(bpmnType, x, y) {
    if (!state.elementFactory || !state.modeling) {
        console.warn("[BPMN Studio] serviços não disponíveis para criar elemento.");
        return null;
    }

    const root = getRootElement();
    if (!root) {
        console.warn("[BPMN Studio] rootElement não encontrado.");
        return null;
    }

    // Flows não podem ser criados soltos.
    if (isFlowType(bpmnType)) {
        console.info(
            `[BPMN Studio] "${bpmnType}" é um conector. ` +
            "Use as setas que aparecem ao passar o mouse sobre um elemento."
        );
        return null;
    }

    try {
        // 1) Cria o "molde" do elemento (shape)
        const shape = state.elementFactory.createShape({ type: bpmnType });

        // 2) Centraliza no ponto de drop
        const w = shape.width || 100;
        const h = shape.height || 80;
        const pos = {
            x: Math.round(x - w / 2),
            y: Math.round(y - h / 2),
        };

        // 3) Adiciona ao modelo
        const created = state.modeling.createShape(shape, pos, root);

        // 4) Seleciona o elemento recém-criado
        if (created) {
            selectElement(created);
        }

        return created;
    } catch (err) {
        console.error(`[BPMN Studio] falha ao criar "${bpmnType}":`, err);
        return null;
    }
}

/**
 * Seleciona um elemento no canvas (com fallback entre APIs).
 */
function selectElement(element) {
    if (!state.modeler || !element) return;

    // Tenta 'selection' (API de alto nível, presente no bpmn-js 17+)
    try {
        const selection = state.modeler.get("selection");
        if (selection && typeof selection.select === "function") {
            selection.select(element);
            return;
        }
    } catch (err) {
        // silencioso — tenta próxima estratégia
    }

    // Fallback: 'modeling.select' (se existir)
    try {
        if (state.modeling && typeof state.modeling.select === "function") {
            state.modeling.select(element);
        }
    } catch (err) {
        // silencioso
    }
}

/**
 * Adiciona um offset em cascata para click-to-create.
 * Evita que elementos criados por clique sucessivo fiquem empilhados.
 */
function nextClickOffset() {
    const offset = state.clickOffset;
    state.clickOffset = (state.clickOffset + 24) % 192;
    return offset;
}

/**
 * Centro do canvas em coordenadas do modelo.
 */
function getCanvasCenter() {
    if (!state.canvas) return { x: 400, y: 300 };
    try {
        const vb = state.canvas.viewbox();
        return {
            x: vb.x + vb.width / 2,
            y: vb.y + vb.height / 2,
        };
    } catch (err) {
        return { x: 400, y: 300 };
    }
}

// ------------------------------------------------------------
// Handlers de drag-and-drop
// ------------------------------------------------------------

function onDragStart(event) {
    const btn = event.target.closest("[data-element]");
    if (!btn) {
        event.preventDefault();
        return;
    }

    const bpmnType = btn.dataset.element;
    state.dragging = { bpmnType };
    btn.classList.add("is-dragging");

    // Firefox exige setData, senão o drag não inicia
    try {
        event.dataTransfer.setData("text/plain", bpmnType);
        event.dataTransfer.effectAllowed = "copy";
    } catch (err) {
        // silencioso
    }
}

function onDragEnd(event) {
    const btn = event.target.closest("[data-element]");
    if (btn) btn.classList.remove("is-dragging");
    state.dragging = null;

    const wrap = document.querySelector(".canvas-wrap");
    if (wrap) wrap.classList.remove("is-drop-target");
}

function onDragOver(event) {
    // Sem preventDefault, o drop não acontece
    event.preventDefault();
    try {
        event.dataTransfer.dropEffect = "copy";
    } catch (err) {
        // silencioso
    }

    const wrap = document.querySelector(".canvas-wrap");
    if (wrap) wrap.classList.add("is-drop-target");
}

function onDragLeave(event) {
    const wrap = document.querySelector(".canvas-wrap");
    if (!wrap) return;
    // Só remove se realmente saiu do wrap (evita flicker em filhos)
    if (event.relatedTarget && wrap.contains(event.relatedTarget)) return;
    wrap.classList.remove("is-drop-target");
}

function onDrop(event) {
    event.preventDefault();

    const wrap = document.querySelector(".canvas-wrap");
    if (wrap) wrap.classList.remove("is-drop-target");

    // Recupera o tipo do elemento
    let bpmnType = state.dragging?.bpmnType;
    if (!bpmnType) {
        try {
            bpmnType = event.dataTransfer.getData("text/plain");
        } catch (err) {
            // silencioso
        }
    }
    if (!bpmnType) return;

    const { x, y } = screenToModel(event.clientX, event.clientY);
    createElement(bpmnType, x, y);
}

// ------------------------------------------------------------
// Handler de click-to-create
// ------------------------------------------------------------

function onSidebarClick(event) {
    const btn = event.target.closest("[data-element]");
    if (!btn) return;

    // Ignora se o clique foi o final de um drag (o navegador emite click após drag)
    if (state.dragging) return;

    const bpmnType = btn.dataset.element;

    if (isFlowType(bpmnType)) {
        console.info(
            `[BPMN Studio] "${bpmnType}" é um conector. ` +
            "Use as setas que aparecem ao passar o mouse sobre um elemento."
        );
        return;
    }

    const center = getCanvasCenter();
    const offset = nextClickOffset();
    createElement(bpmnType, center.x + offset, center.y + offset);
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

/**
 * Inicializa a palette.
 * Deve ser chamado APÓS modeler.init().
 *
 * @param {object} modeler - instância do bpmn-js
 */
export function init(modeler) {
    if (!modeler) {
        console.warn("[BPMN Studio] palette.init() sem modeler.");
        return;
    }

    state.modeler = modeler;

    const services = resolveServices(modeler);
    if (!services) {
        console.warn("[BPMN Studio] palette não pôde resolver serviços do bpmn-js.");
        return;
    }

    state.elementFactory = services.elementFactory;
    state.modeling = services.modeling;
    state.canvas = services.canvas;

    // ----- Sidebar (drag source + click) -----
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) {
        console.warn("[BPMN Studio] .sidebar não encontrada no DOM.");
        return;
    }

    sidebar.addEventListener("dragstart", onDragStart);
    sidebar.addEventListener("dragend", onDragEnd);
    sidebar.addEventListener("click", onSidebarClick);
    state.listeners.push({ el: sidebar, type: "dragstart", fn: onDragStart });
    state.listeners.push({ el: sidebar, type: "dragend", fn: onDragEnd });
    state.listeners.push({ el: sidebar, type: "click", fn: onSidebarClick });

    // ----- Canvas (drop target) -----
    const wrap = document.querySelector(".canvas-wrap");
    if (!wrap) {
        console.warn("[BPMN Studio] .canvas-wrap não encontrado no DOM.");
        return;
    }

    wrap.addEventListener("dragover", onDragOver);
    wrap.addEventListener("dragleave", onDragLeave);
    wrap.addEventListener("drop", onDrop);
    state.listeners.push({ el: wrap, type: "dragover", fn: onDragOver });
    state.listeners.push({ el: wrap, type: "dragleave", fn: onDragLeave });
    state.listeners.push({ el: wrap, type: "drop", fn: onDrop });

    // Marca todos os elementos da sidebar como draggable
    enableDraggable();

    console.info("[BPMN Studio] palette inicializada.");
}

/**
 * Marca todos os itens da sidebar com `draggable="true"`.
 * Necessário porque o atributo não é herdado do pai.
 */
function enableDraggable() {
    const items = document.querySelectorAll(".sidebar [data-element]");
    for (const el of items) {
        el.setAttribute("draggable", "true");
    }
}

/**
 * Remove listeners e limpa estado.
 */
export function destroy() {
    for (const { el, type, fn } of state.listeners) {
        try {
            el.removeEventListener(type, fn);
        } catch (err) {
            // silencioso
        }
    }
    state.listeners = [];
    state.modeler = null;
    state.elementFactory = null;
    state.modeling = null;
    state.canvas = null;
    state.dragging = null;
    state.clickOffset = 0;
}

/**
 * Recria os atributos `draggable` (útil se a sidebar for
 * reconstruída dinamicamente em versões futuras).
 */
export function refresh() {
    enableDraggable();
}

/**
 * Lista os tipos BPMN que a paleta expõe no DOM.
 * Útil para debug e para validação futura.
 */
export function listTypes() {
    const items = document.querySelectorAll(".sidebar [data-element]");
    return Array.from(items).map((el) => el.dataset.element);
}