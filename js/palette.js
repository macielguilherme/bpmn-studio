/* ============================================================
   BPMN Studio — js/palette.js
   Sidebar de elementos BPMN. Drag-and-drop + click-to-create.
   Injeta a paleta dentro de #palette-container.
   ============================================================ */

const state = {
    modeler: null,
    elementFactory: null,
    modeling: null,
    canvas: null,
    bpmnFactory: null,
    container: null,
    listeners: [],
    dragging: null,
    clickOffset: 0,
    collapsedGroups: new Set(),
    searchTerm: "",
};

// ------------------------------------------------------------
// Catálogo de elementos
// ------------------------------------------------------------

const GROUPS = [
    { id: "events", label: "Eventos", open: true },
    { id: "activities", label: "Tarefas", open: true },
    { id: "subprocesses", label: "Subprocessos", open: true },
    { id: "gateways", label: "Gateways", open: true },
    { id: "connectors", label: "Conectores", open: true },
    { id: "data", label: "Dados", open: false },
    { id: "containers", label: "Estrutura", open: false },
    { id: "artifacts", label: "Artefatos", open: false },
];

const ITEMS = [
    // Eventos
    { id: "start-event", group: "events", label: "Evento Inicial", type: "bpmn:StartEvent", icon: "event-start", keywords: "inicio inicio start começo" },
    { id: "intermediate-catch", group: "events", label: "Intermediário (Catch)", type: "bpmn:IntermediateCatchEvent", icon: "event-intermediate", keywords: "intermediario intermediário catch espera" },
    { id: "intermediate-throw", group: "events", label: "Intermediário (Throw)", type: "bpmn:IntermediateThrowEvent", icon: "event-intermediate", keywords: "intermediario intermediário throw disparar" },
    { id: "boundary-event", group: "events", label: "Evento de Borda", type: "bpmn:BoundaryEvent", icon: "event-boundary", keywords: "borda boundary anexo" },
    { id: "end-event", group: "events", label: "Evento Final", type: "bpmn:EndEvent", icon: "event-end", keywords: "fim final end encerramento termino término" },

    // Tarefas
    { id: "task", group: "activities", label: "Tarefa", type: "bpmn:Task", icon: "task", keywords: "tarefa task atividade" },
    { id: "user-task", group: "activities", label: "Tarefa de Usuário", type: "bpmn:UserTask", icon: "task-user", keywords: "usuario usuário user pessoa humana" },
    { id: "service-task", group: "activities", label: "Tarefa de Serviço", type: "bpmn:ServiceTask", icon: "task-service", keywords: "servico serviço service sistema automacao automação api" },
    { id: "script-task", group: "activities", label: "Tarefa de Script", type: "bpmn:ScriptTask", icon: "task-script", keywords: "script codigo código automacao automação" },
    { id: "manual-task", group: "activities", label: "Tarefa Manual", type: "bpmn:ManualTask", icon: "task-manual", keywords: "manual pessoa fisico físico" },
    { id: "business-rule-task", group: "activities", label: "Tarefa de Regra", type: "bpmn:BusinessRuleTask", icon: "task-rule", keywords: "regra negocio negócio business rule decisao decisão" },
    { id: "send-task", group: "activities", label: "Tarefa de Envio", type: "bpmn:SendTask", icon: "task-send", keywords: "enviar envio send mensagem email" },
    { id: "receive-task", group: "activities", label: "Tarefa de Recebimento", type: "bpmn:ReceiveTask", icon: "task-receive", keywords: "receber recebimento receive mensagem" },

    // Subprocessos
    { id: "subprocess", group: "subprocesses", label: "Subprocesso", type: "bpmn:SubProcess", icon: "subprocess", keywords: "subprocesso subprocess agrupamento" },
    { id: "subprocess-collapsed", group: "subprocesses", label: "Subprocesso Colapsado", type: "bpmn:SubProcess", icon: "subprocess", collapsed: true, keywords: "subprocesso colapsado subprocess" },
    { id: "call-activity", group: "subprocesses", label: "Atividade de Chamada", type: "bpmn:CallActivity", icon: "call-activity", keywords: "call chamada processo reutilizar" },

    // Gateways
    { id: "exclusive-gateway", group: "gateways", label: "Exclusivo (XOR)", type: "bpmn:ExclusiveGateway", icon: "gateway-xor", keywords: "gateway exclusivo xor decisao decisão if condicao condição" },
    { id: "parallel-gateway", group: "gateways", label: "Paralelo (AND)", type: "bpmn:ParallelGateway", icon: "gateway-parallel", keywords: "gateway paralelo parallel and fork join" },
    { id: "inclusive-gateway", group: "gateways", label: "Inclusivo (OR)", type: "bpmn:InclusiveGateway", icon: "gateway-inclusive", keywords: "gateway inclusivo inclusive or" },
    { id: "event-based-gateway", group: "gateways", label: "Baseado em Evento", type: "bpmn:EventBasedGateway", icon: "gateway-event", keywords: "gateway evento event based" },
    { id: "complex-gateway", group: "gateways", label: "Complexo", type: "bpmn:ComplexGateway", icon: "gateway-complex", keywords: "gateway complexo complex" },

    // Conectores
    { id: "sequence-flow", group: "connectors", label: "Fluxo de Sequência", type: "bpmn:SequenceFlow", icon: "flow-sequence", isFlow: true, keywords: "fluxo sequencia sequência sequence flow seta" },
    { id: "message-flow", group: "connectors", label: "Fluxo de Mensagem", type: "bpmn:MessageFlow", icon: "flow-message", isFlow: true, keywords: "fluxo mensagem message flow" },
    { id: "association", group: "connectors", label: "Associação", type: "bpmn:Association", icon: "flow-association", isFlow: true, keywords: "associação associacao association" },

    // Dados
    { id: "data-object", group: "data", label: "Objeto de Dados", type: "bpmn:DataObjectReference", icon: "data-object", keywords: "dados documento objeto data" },
    { id: "data-store", group: "data", label: "Armazenamento", type: "bpmn:DataStoreReference", icon: "data-store", keywords: "dados banco armazenamento database" },

    // Estrutura
    { id: "participant", group: "containers", label: "Pool", type: "bpmn:Participant", icon: "participant", keywords: "pool participante organizacao organização" },
    { id: "lane", group: "containers", label: "Lane", type: "bpmn:Lane", icon: "lane", keywords: "lane raia responsavel responsável" },

    // Artefatos
    { id: "text-annotation", group: "artifacts", label: "Anotação", type: "bpmn:TextAnnotation", icon: "annotation", keywords: "anotacao anotação texto nota" },
    { id: "group", group: "artifacts", label: "Grupo", type: "bpmn:Group", icon: "group", keywords: "grupo group agrupar" },
];

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function normalize(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function resolveServices(modeler) {
    try {
        return {
            elementFactory: modeler.get("elementFactory"),
            modeling: modeler.get("modeling"),
            canvas: modeler.get("canvas"),
            bpmnFactory: modeler.get("bpmnFactory"),
        };
    } catch (err) {
        console.warn("[BPMN Studio] serviços indisponíveis:", err);
        return null;
    }
}

function getRootElement() {
    if (!state.canvas) return null;
    try {
        return state.canvas.getRootElement();
    } catch {
        return null;
    }
}

function screenToModel(clientX, clientY) {
    if (!state.canvas) return { x: 0, y: 0 };
    try {
        const vb = state.canvas.viewbox();
        const canvasEl = document.querySelector(".canvas-wrap");
        const rect = canvasEl
            ? canvasEl.getBoundingClientRect()
            : { left: 0, top: 0 };

        const relX = clientX - rect.left;
        const relY = clientY - rect.top;

        return {
            x: vb.x + relX / vb.scale,
            y: vb.y + relY / vb.scale,
        };
    } catch {
        return { x: clientX, y: clientY };
    }
}

function getCanvasCenter() {
    if (!state.canvas) return { x: 400, y: 300 };
    try {
        const vb = state.canvas.viewbox();
        return {
            x: vb.x + vb.width / 2,
            y: vb.y + vb.height / 2,
        };
    } catch {
        return { x: 400, y: 300 };
    }
}

// ------------------------------------------------------------
// Criação de elementos
// ------------------------------------------------------------

function createEventDefinition(definitionType) {
    if (!definitionType || !state.bpmnFactory) return null;
    try {
        return state.bpmnFactory.create(definitionType);
    } catch {
        return null;
    }
}

function createElement(bpmnType, x, y, options = {}) {
    if (!state.elementFactory || !state.modeling) {
        console.warn("[BPMN Studio] serviços não disponíveis.");
        return null;
    }

    const root = getRootElement();
    if (!root) {
        console.warn("[BPMN Studio] rootElement ausente.");
        return null;
    }

    try {
        const shapeProps = { type: bpmnType };

        if (options.eventDefinition) {
            const def = createEventDefinition(options.eventDefinition);
            if (def) {
                shapeProps.eventDefinitionType = options.eventDefinition;
                shapeProps.eventDefinition = def;
            }
        }

        if (options.collapsed) {
            shapeProps.isExpanded = false;
        }

        const shape = state.elementFactory.createShape(shapeProps);

        const w = shape.width || 100;
        const h = shape.height || 80;

        const pos = {
            x: Math.round(x - w / 2),
            y: Math.round(y - h / 2),
        };

        const created = state.modeling.createShape(shape, pos, root);

        if (created) selectElement(created);
        return created;
    } catch (err) {
        console.error(`[BPMN Studio] falha ao criar "${bpmnType}":`, err);
        return null;
    }
}

function selectElement(element) {
    if (!state.modeler || !element) return;

    try {
        const selection = state.modeler.get("selection");
        if (selection && typeof selection.select === "function") {
            selection.select(element);
            return;
        }
    } catch {
        // fallback
    }

    try {
        if (state.modeling && typeof state.modeling.select === "function") {
            state.modeling.select(element);
        }
    } catch {
        // silencioso
    }
}

function nextClickOffset() {
    const offset = state.clickOffset;
    state.clickOffset = (state.clickOffset + 24) % 192;
    return offset;
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------

function getFilteredItems() {
    if (!state.searchTerm) return ITEMS;

    const term = normalize(state.searchTerm);

    return ITEMS.filter((item) => {
        const haystack = normalize(
            `${item.label} ${item.type} ${item.keywords || ""}`
        );
        return haystack.includes(term);
    });
}

function getIconSvg(icon) {
    const svgs = {
        "event-start": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>',
        "event-intermediate": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/></svg>',
        "event-boundary": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/></svg>',
        "event-end": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="8"/></svg>',
        "task": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>',
        "task-user": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/><circle cx="12" cy="11" r="2"/><path d="M9 15c0-1.5 1.5-2 3-2s3 .5 3 2"/></svg>',
        "task-service": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/><path d="M12 10v4M10 12h4"/></svg>',
        "task-script": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/><path d="M8 11h8M8 14h5"/></svg>',
        "task-manual": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/><path d="M9 12h6"/></svg>',
        "task-rule": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/><path d="M12 10v4M8 12h8"/></svg>',
        "task-send": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/><path d="M4 7l8 6 8-6"/></svg>',
        "task-receive": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/><path d="M4 17l8-6 8 6"/></svg>',
        "subprocess": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/><path d="M12 10v4M10 12h4"/></svg>',
        "call-activity": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>',
        "gateway-xor": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 9-9 9-9-9z"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
        "gateway-parallel": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 9-9 9-9-9z"/><path d="M12 8v8M8 12h8"/></svg>',
        "gateway-inclusive": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 9-9 9-9-9z"/><circle cx="12" cy="12" r="3"/></svg>',
        "gateway-event": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 9-9 9-9-9z"/><circle cx="12" cy="12" r="4"/></svg>',
        "gateway-complex": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 9-9 9-9-9z"/><path d="M12 8v8M8 12h8"/></svg>',
        "flow-sequence": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18"/><path d="M16 7l5 5-5 5"/></svg>',
        "flow-message": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18" stroke-dasharray="3 3"/><path d="M16 7l5 5-5 5"/></svg>',
        "flow-association": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18" stroke-dasharray="2 4"/></svg>',
        "data-object": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h9l3 3v13H6z"/><path d="M15 4v3h3"/></svg>',
        "data-store": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.5 3.5 2.5 7 2.5s7-1 7-2.5V6"/></svg>',
        "participant": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="1"/><line x1="8" y1="5" x2="8" y2="19"/></svg>',
        "lane": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="1"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        "annotation": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4v16"/><path d="M10 6h8M10 12h8M10 18h5"/></svg>',
        "group": '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>',
    };

    return svgs[icon] || '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="1"/></svg>';
}

function render() {
    if (!state.container) return;

    const groupsHtml = GROUPS.map((group) => {
        const items = getFilteredItems().filter((i) => i.group === group.id);

        if (items.length === 0) return "";

        const isCollapsed = state.collapsedGroups.has(group.id);
        const contentStyle = isCollapsed ? "display:none" : "";

        const itemsHtml = items.map((item) => `
            <button type="button" class="palette-item"
                data-id="${escapeHtml(item.id)}"
                data-element="${escapeHtml(item.type)}"
                ${item.collapsed ? 'data-collapsed="true"' : ""}
                title="${escapeHtml(item.label)}">
                <span class="palette-item__icon palette-icon--${escapeHtml(item.icon)}">${getIconSvg(item.icon)}</span>
                <span class="palette-item__label">${escapeHtml(item.label)}</span>
            </button>
        `).join("");

        return `
            <section class="palette-section" data-group="${escapeHtml(group.id)}">
                <button type="button" class="palette-section__header"
                    data-group-toggle="${escapeHtml(group.id)}"
                    aria-expanded="${!isCollapsed}">
                    <span class="palette-section__title">${escapeHtml(group.label)}</span>
                    <span class="palette-section__chevron" aria-hidden="true">${isCollapsed ? "›" : "⌄"}</span>
                </button>
                <div class="palette-section__content" style="${contentStyle}">
                    ${itemsHtml}
                </div>
            </section>
        `;
    }).join("");

    const emptyHtml = `
        <div class="palette-empty">
            <strong>Nenhum elemento encontrado</strong>
            <span>Tente outro termo de busca.</span>
        </div>
    `;

    state.container.innerHTML = `
        <div class="palette">
            <div class="palette__search">
                <input type="search"
                    class="palette__search-input"
                    placeholder="Buscar elemento..."
                    autocomplete="off"
                    spellcheck="false"
                    value="${escapeHtml(state.searchTerm)}"
                    aria-label="Buscar elemento BPMN">
                <button type="button" class="palette__search-clear"
                    aria-label="Limpar busca" ${state.searchTerm ? "" : "hidden"}>×</button>
            </div>
            <div class="palette__groups">
                ${groupsHtml || emptyHtml}
            </div>
        </div>
    `;

    bindRenderedEvents();
}

function bindRenderedEvents() {
    if (!state.container) return;

    const searchInput = state.container.querySelector(".palette__search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            state.searchTerm = e.target.value;
            render();
            const refocus = state.container.querySelector(".palette__search-input");
            if (refocus) {
                refocus.focus();
                refocus.setSelectionRange(refocus.value.length, refocus.value.length);
            }
        });
    }

    state.container.querySelectorAll(".palette__search-clear").forEach((btn) => {
        btn.addEventListener("click", () => {
            state.searchTerm = "";
            render();
        });
    });

    state.container.querySelectorAll("[data-group-toggle]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.groupToggle;
            if (state.collapsedGroups.has(id)) {
                state.collapsedGroups.delete(id);
            } else {
                state.collapsedGroups.add(id);
            }
            render();
        });
    });

    state.container.querySelectorAll(".palette-item").forEach((btn) => {
        btn.setAttribute("draggable", "true");

        btn.addEventListener("dragstart", (e) => {
            const item = ITEMS.find((i) => i.id === btn.dataset.id);
            if (!item) return;

            state.dragging = item;
            btn.classList.add("is-dragging");

            try {
                e.dataTransfer.setData("text/plain", item.type);
                e.dataTransfer.effectAllowed = "copy";
            } catch {
                // silencioso
            }
        });

        btn.addEventListener("dragend", () => {
            state.dragging = null;
            btn.classList.remove("is-dragging");
            const wrap = document.querySelector(".canvas-wrap");
            if (wrap) wrap.classList.remove("is-drop-target");
        });

        btn.addEventListener("click", () => {
            if (state.dragging) return;

            const item = ITEMS.find((i) => i.id === btn.dataset.id);
            if (!item || item.isFlow) {
                console.info(
                    `[BPMN Studio] "${item?.label}" é um conector. Arraste a partir das bordas de um elemento.`
                );
                return;
            }

            const center = getCanvasCenter();
            const offset = nextClickOffset();

            createElement(item.type, center.x + offset, center.y + offset, {
                collapsed: item.collapsed,
            });
        });
    });
}

// ------------------------------------------------------------
// Drop no canvas
// ------------------------------------------------------------

function installDropTarget() {
    const wrap = document.querySelector(".canvas-wrap");
    if (!wrap) return;

    const onDragOver = (e) => {
        e.preventDefault();
        try {
            e.dataTransfer.dropEffect = "copy";
        } catch {
            // silencioso
        }
        wrap.classList.add("is-drop-target");
    };

    const onDragLeave = (e) => {
        if (e.relatedTarget && wrap.contains(e.relatedTarget)) return;
        wrap.classList.remove("is-drop-target");
    };

    const onDrop = (e) => {
        e.preventDefault();
        wrap.classList.remove("is-drop-target");

        const item = state.dragging;
        if (!item) return;

        if (item.isFlow) {
            console.info(
                `[BPMN Studio] "${item.label}" é um conector. Arraste a partir das bordas de um elemento.`
            );
            return;
        }

        const { x, y } = screenToModel(e.clientX, e.clientY);
        createElement(item.type, x, y, { collapsed: item.collapsed });
        state.dragging = null;
    };

    wrap.addEventListener("dragover", onDragOver);
    wrap.addEventListener("dragleave", onDragLeave);
    wrap.addEventListener("drop", onDrop);

    state.listeners.push({ el: wrap, type: "dragover", fn: onDragOver });
    state.listeners.push({ el: wrap, type: "dragleave", fn: onDragLeave });
    state.listeners.push({ el: wrap, type: "drop", fn: onDrop });
}

// ------------------------------------------------------------
// API
// ------------------------------------------------------------

export function init(modeler, options = {}) {
    if (!modeler) {
        console.warn("[BPMN Studio] palette.init() sem modeler.");
        return;
    }

    state.modeler = modeler;

    const services = resolveServices(modeler);
    if (!services) return;

    state.elementFactory = services.elementFactory;
    state.modeling = services.modeling;
    state.canvas = services.canvas;
    state.bpmnFactory = services.bpmnFactory;

    state.container =
        options.container ||
        document.getElementById("palette-container");

    if (!state.container) {
        console.warn("[BPMN Studio] container da palette não encontrado.");
        return;
    }

    render();
    installDropTarget();

    console.info("[BPMN Studio] palette inicializada.");
}

export function destroy() {
    for (const { el, type, fn } of state.listeners) {
        try {
            el.removeEventListener(type, fn);
        } catch {
            // silencioso
        }
    }

    state.listeners = [];
    state.modeler = null;
    state.elementFactory = null;
    state.modeling = null;
    state.canvas = null;
    state.bpmnFactory = null;
    state.container = null;
    state.dragging = null;
    state.clickOffset = 0;
}

export function refresh() {
    render();
}

export function listTypes() {
    return ITEMS.map((i) => ({
        id: i.id,
        type: i.type,
        label: i.label,
        group: i.group,
    }));
}

export function focusSearch() {
    const input = state.container?.querySelector(".palette__search-input");
    if (input) {
        input.focus();
        input.select();
    }
}