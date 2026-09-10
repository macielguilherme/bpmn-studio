/* ============================================================
   BPMN Studio — js/editor/properties.js
   Painel de propriedades do elemento selecionado.
   Edita nome, ID e mostra tipo do elemento no canvas.
   ============================================================ */

// ------------------------------------------------------------
// Estado do módulo (singleton)
// ------------------------------------------------------------
const state = {
    modeler: null,
    bodyEl: null,
    panelEl: null,
    listeners: [],
    currentElement: null,
    isUpdatingFromModel: false, // evita loop input → model → input
};

// ------------------------------------------------------------
// Helpers internos
// ------------------------------------------------------------

/**
 * Retorna o modeling (para aplicar mudanças) ou null.
 */
function getModeling() {
    if (!state.modeler) return null;
    try {
        return state.modeler.get("modeling");
    } catch (err) {
        return null;
    }
}

/**
 * Rótulo amigável para o tipo BPMN.
 */
function friendlyType(bpmnType) {
    if (!bpmnType) return "Elemento";
    const short = bpmnType.replace(/^bpmn:/, "");
    const map = {
        StartEvent: "Evento Inicial",
        EndEvent: "Evento Final",
        IntermediateThrowEvent: "Evento Intermediário",
        IntermediateCatchEvent: "Evento Intermediário",
        BoundaryEvent: "Evento de Borda",
        Task: "Tarefa",
        UserTask: "Tarefa de Usuário",
        ServiceTask: "Tarefa de Serviço",
        ScriptTask: "Tarefa de Script",
        ManualTask: "Tarefa Manual",
        BusinessRuleTask: "Tarefa de Regra",
        SendTask: "Tarefa de Envio",
        ReceiveTask: "Tarefa de Recebimento",
        CallActivity: "Atividade de Chamada",
        SubProcess: "Subprocesso",
        ExclusiveGateway: "Gateway Exclusivo",
        ParallelGateway: "Gateway Paralelo",
        InclusiveGateway: "Gateway Inclusivo",
        EventBasedGateway: "Gateway Baseado em Evento",
        ComplexGateway: "Gateway Complexo",
        SequenceFlow: "Fluxo de Sequência",
        MessageFlow: "Fluxo de Mensagem",
        Participant: "Pool",
        Lane: "Lane",
        DataObjectReference: "Objeto de Dados",
        DataStoreReference: "Armazenamento de Dados",
        Process: "Processo",
        Collaboration: "Colaboração",
    };
    return map[short] || short;
}

/**
 * Ícone (emoji/símbolo) simples por categoria.
 * Não usa imagem para manter zero dependências.
 */
function typeIcon(bpmnType) {
    if (!bpmnType) return "•";
    if (bpmnType.endsWith("Event")) return "◯";
    if (bpmnType.endsWith("Gateway")) return "◇";
    if (bpmnType.endsWith("Task") || bpmnType === "bpmn:SubProcess") return "▢";
    if (bpmnType.endsWith("Flow")) return "→";
    if (bpmnType === "bpmn:Participant" || bpmnType === "bpmn:Lane") return "▤";
    if (bpmnType.includes("Data")) return "▧";
    return "•";
}

/**
 * Cria um input de texto com label.
 */
function createTextInput({ id, label, value, placeholder, onChange }) {
    const wrap = document.createElement("div");
    wrap.className = "properties__field";

    const labelEl = document.createElement("label");
    labelEl.className = "input-label";
    labelEl.setAttribute("for", id);
    labelEl.textContent = label;

    const input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.className = "input";
    input.value = value || "";
    if (placeholder) input.placeholder = placeholder;

    // Aplica no "blur" e no "Enter" (não a cada tecla — evita spam no commandStack)
    input.addEventListener("blur", () => onChange(input.value));
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            input.blur();
        }
        if (e.key === "Escape") {
            // Reverte para o valor do modelo
            input.value = state.currentElement?.businessObject?.name || "";
            input.blur();
        }
    });

    wrap.appendChild(labelEl);
    wrap.appendChild(input);
    return wrap;
}

/**
 * Cria um campo readonly (ID).
 */
function createReadonlyField({ label, value }) {
    const wrap = document.createElement("div");
    wrap.className = "properties__field";

    const labelEl = document.createElement("label");
    labelEl.className = "input-label";
    labelEl.textContent = label;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "input input--readonly";
    input.value = value || "";
    input.readOnly = true;
    input.tabIndex = -1;

    wrap.appendChild(labelEl);
    wrap.appendChild(input);
    return wrap;
}

/**
 * Cria o cabeçalho com ícone + tipo.
 */
function createTypeHeader(bpmnType) {
    const header = document.createElement("div");
    header.className = "properties__header";

    const icon = document.createElement("span");
    icon.className = "properties__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = typeIcon(bpmnType);

    const label = document.createElement("span");
    label.className = "properties__type";
    label.textContent = friendlyType(bpmnType);

    header.appendChild(icon);
    header.appendChild(label);
    return header;
}

/**
 * Renderiza o estado vazio (nenhum elemento selecionado).
 */
function renderEmpty() {
    if (!state.bodyEl) return;
    state.bodyEl.innerHTML = "";

    const empty = document.createElement("p");
    empty.className = "properties__empty";
    empty.textContent = "Nenhum elemento selecionado.";
    state.bodyEl.appendChild(empty);
}

/**
 * Aplica mudança de nome no modelo.
 */
function applyName(value) {
    const modeling = getModeling();
    const el = state.currentElement;
    if (!modeling || !el) return;

    const newName = (value || "").trim();
    const oldName = el.businessObject?.name || "";
    if (newName === oldName) return;

    state.isUpdatingFromModel = true;
    try {
        modeling.updateProperties(el, { name: newName || undefined });
    } catch (err) {
        console.error("[BPMN Studio] erro ao renomear elemento:", err);
    } finally {
        state.isUpdatingFromModel = false;
    }
}

/**
 * Renderiza o formulário do elemento selecionado.
 */
function renderElement(element) {
    if (!state.bodyEl) return;
    state.bodyEl.innerHTML = "";

    if (!element || !element.businessObject) {
        renderEmpty();
        return;
    }

    const bo = element.businessObject;
    const bpmnType = bo.$type;

    // Cabeçalho (tipo)
    state.bodyEl.appendChild(createTypeHeader(bpmnType));

    // Campo: Nome
    state.bodyEl.appendChild(
        createTextInput({
            id: "prop-name",
            label: "Nome",
            value: bo.name || "",
            placeholder: "Digite um nome...",
            onChange: applyName,
        })
    );

    // Campo: ID (readonly)
    state.bodyEl.appendChild(
        createReadonlyField({
            label: "ID",
            value: bo.id || element.id || "",
        })
    );
}

// ------------------------------------------------------------
// Listeners do bpmn-js
// ------------------------------------------------------------

/**
 * Handler de seleção. Atualiza o painel quando o usuário clica
 * em um elemento do canvas.
 */
function onSelectionChanged(event) {
    const selected = event?.newSelection?.[0] || null;

    // Se a seleção mudou e o input está com foco, perde o foco
    // (evita perder edição digitada ao clicar em outro elemento)
    if (document.activeElement?.classList?.contains("input")) {
        document.activeElement.blur();
    }

    state.currentElement = selected || null;

    if (!selected) {
        renderEmpty();
    } else {
        renderElement(selected);
    }
}

/**
 * Handler de mudança no modelo. Se o elemento selecionado for
 * alterado externamente (ex.: undo/redo), re-renderiza.
 * Evita loop quando a mudança veio do próprio painel.
 */
function onElementsChanged(event) {
    if (state.isUpdatingFromModel) return;
    if (!state.currentElement) return;

    const changed = event?.elements || [];
    const affected = changed.some(
        (el) =>
            el.id === state.currentElement.id ||
            el.businessObject?.id === state.currentElement.businessObject?.id
    );

    if (affected) {
        renderElement(state.currentElement);
    }
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

/**
 * Inicializa o painel de propriedades.
 * @param {object} modeler - instância do bpmn-js
 */
export function init(modeler) {
    if (!modeler) {
        console.warn("[BPMN Studio] properties.init() sem modeler.");
        return;
    }

    state.modeler = modeler;
    state.panelEl = document.getElementById("properties");
    state.bodyEl = document.getElementById("properties-body");

    // Estado inicial: vazio
    renderEmpty();

    // Escuta seleção
    const selHandler = (e) => onSelectionChanged(e);
    modeler.on("selection.changed", selHandler);
    state.listeners.push({ event: "selection.changed", handler: selHandler });

    // Escuta mudanças no modelo (para re-render após undo/redo)
    const elHandler = (e) => onElementsChanged(e);
    modeler.on("elements.changed", elHandler);
    state.listeners.push({ event: "elements.changed", handler: elHandler });
}

/**
 * Remove listeners e limpa o painel.
 */
export function destroy() {
    if (state.modeler && typeof state.modeler.off === "function") {
        for (const { event, handler } of state.listeners) {
            try {
                state.modeler.off(event, handler);
            } catch (err) {
                // silencioso
            }
        }
    }
    state.listeners = [];
    state.modeler = null;
    state.currentElement = null;
    renderEmpty();
}

/**
 * Força renderização do estado atual.
 */
export function refresh() {
    if (state.currentElement) {
        renderElement(state.currentElement);
    } else {
        renderEmpty();
    }
}

/**
 * Retorna o elemento atualmente em edição.
 */
export function getCurrent() {
    return state.currentElement;
}