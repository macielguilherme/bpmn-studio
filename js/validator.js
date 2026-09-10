/* ============================================================
   BPMN Studio — js/validator.js
   Validação estrutural do diagrama BPMN 2.0.
   - Mensagens explicativas + dica de correção
   - Toggles por nível (on/off)
   - Botão "Resolver" que aplica correção real
   ============================================================ */

const state = {
    modeler: null,
    listEl: null,
    panelEl: null,
    summaryEl: null,
    filtersEl: null,
    notifications: null,
    listeners: [],
    lastReport: [],
    activeFilters: {
        error: true,
        warning: true,
        info: true,
        success: false,
    },
};

const LEVEL = {
    SUCCESS: "success",
    WARNING: "warning",
    ERROR: "error",
    INFO: "info",
};

const LEVEL_META = {
    [LEVEL.ERROR]: { icon: "!", label: "Erros" },
    [LEVEL.WARNING]: { icon: "!", label: "Avisos" },
    [LEVEL.INFO]: { icon: "i", label: "Info" },
    [LEVEL.SUCCESS]: { icon: "v", label: "OK" },
};

// ------------------------------------------------------------
// Serviços
// ------------------------------------------------------------

function getRegistry() {
    try { return state.modeler.get("elementRegistry"); } catch { return null; }
}
function getCanvas() {
    try { return state.modeler.get("canvas"); } catch { return null; }
}
function getSelection() {
    try { return state.modeler.get("selection"); } catch { return null; }
}
function getModeling() {
    try { return state.modeler.get("modeling"); } catch { return null; }
}
function getElementFactory() {
    try { return state.modeler.get("elementFactory"); } catch { return null; }
}

// ------------------------------------------------------------
// Predicados
// ------------------------------------------------------------

function isStartEvent(el) {
    return el?.businessObject?.$type === "bpmn:StartEvent";
}
function isEndEvent(el) {
    return el?.businessObject?.$type === "bpmn:EndEvent";
}
function isGateway(el) {
    return el?.businessObject?.$type?.endsWith("Gateway") || false;
}
function isTask(el) {
    const t = el?.businessObject?.$type;
    if (!t) return false;
    return t.endsWith("Task") || t === "bpmn:SubProcess" || t === "bpmn:CallActivity";
}
function isFlowNode(el) {
    if (!el || !el.businessObject) return false;
    const t = el.businessObject.$type;
    return (
        t.endsWith("Event") ||
        t.endsWith("Task") ||
        t.endsWith("Gateway") ||
        t === "bpmn:SubProcess" ||
        t === "bpmn:CallActivity"
    );
}
function getSequenceFlows(registry) {
    return registry.filter(
        (el) => el.businessObject?.$type === "bpmn:SequenceFlow"
    );
}

// ------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function describeElement(el) {
    const bo = el?.businessObject;
    if (!bo) return "elemento";
    const name = bo.name?.trim();
    if (name) return `"${name}"`;
    return bo.$type?.replace("bpmn:", "") || "Elemento";
}

function pluralize(n, singular, plural) {
    return `${n} ${n === 1 ? singular : plural}`;
}

function focusElement(el) {
    if (!el) return;
    try {
        const selection = getSelection();
        if (selection) selection.select(el);
    } catch { /* silencioso */ }
    try {
        const canvas = getCanvas();
        if (canvas && el.x !== undefined) {
            canvas.scrollToElement?.(el, { top: 80, left: 80, bottom: 80, right: 80 });
        }
    } catch { /* silencioso */ }
}

function autoNameForTask(el) {
    const type = el.businessObject.$type.replace("bpmn:", "");
    const map = {
        Task: "Tarefa",
        UserTask: "Tarefa de Usuário",
        ServiceTask: "Tarefa de Serviço",
        ScriptTask: "Tarefa de Script",
        ManualTask: "Tarefa Manual",
        BusinessRuleTask: "Tarefa de Regra",
        SendTask: "Enviar Mensagem",
        ReceiveTask: "Receber Mensagem",
        SubProcess: "Subprocesso",
        CallActivity: "Chamada",
    };
    return map[type] || "Tarefa";
}

function autoNameForGateway(el) {
    const type = el.businessObject.$type.replace("bpmn:", "");
    const map = {
        ExclusiveGateway: "Decisão?",
        ParallelGateway: "Paralelo",
        InclusiveGateway: "Inclusivo?",
        EventBasedGateway: "Evento?",
        ComplexGateway: "Complexo",
    };
    return map[type] || "Gateway";
}

function autoNameForFlow(flow, index) {
    return index === 0 ? "Sim" : "Não";
}

// ------------------------------------------------------------
// Regras
// ------------------------------------------------------------

const RULES = [
    // 1. Evento inicial
    {
        id: "has-start-event",
        run(registry) {
            const starts = registry.filter(isStartEvent);

            if (starts.length === 0) {
                return {
                    level: LEVEL.ERROR,
                    message: "O processo não possui evento inicial.",
                    hint: "Todo processo BPMN 2.0 deve começar com um evento inicial.",
                    fix: {
                        label: "Criar evento inicial",
                        fn: () => createStartEvent(),
                    },
                };
            }

            return { level: LEVEL.SUCCESS, message: "Evento inicial presente." };
        },
    },

    // 2. Evento final
    {
        id: "has-end-event",
        run(registry) {
            const ends = registry.filter(isEndEvent);

            if (ends.length === 0) {
                return {
                    level: LEVEL.ERROR,
                    message: "O processo não possui evento final.",
                    hint: "Todo fluxo precisa terminar em um evento final.",
                    fix: {
                        label: "Criar evento final",
                        fn: () => createEndEvent(),
                    },
                };
            }

            return { level: LEVEL.SUCCESS, message: "Evento final presente." };
        },
    },

    // 3. Fluxos conectados
    {
        id: "flows-connected",
        run(registry) {
            const flows = getSequenceFlows(registry);

            if (flows.length === 0) {
                return {
                    level: LEVEL.INFO,
                    message: "Ainda não há fluxos de sequência.",
                    hint: "Conecte os elementos arrastando a partir das bordas.",
                };
            }

            const broken = flows.filter(
                (f) => !f.businessObject.sourceRef || !f.businessObject.targetRef
            );

            if (broken.length > 0) {
                return {
                    level: LEVEL.ERROR,
                    message: `${pluralize(broken.length, "fluxo está sem origem ou destino", "fluxos estão sem origem ou destino")}.`,
                    hint: "Reconecte cada fluxo ou remova-o.",
                    elements: broken,
                    fix: {
                        label: "Remover fluxos",
                        fn: () => removeElements(broken),
                    },
                };
            }

            return {
                level: LEVEL.SUCCESS,
                message: `${pluralize(flows.length, "fluxo conectado", "fluxos conectados")}.`,
            };
        },
    },

    // 4. Elementos isolados
    {
        id: "no-orphans",
        run(registry) {
            const flows = getSequenceFlows(registry);
            if (flows.length === 0) return null;

            const nodes = registry.filter(isFlowNode);
            const orphans = [];

            for (const node of nodes) {
                if (!isTask(node) && !isGateway(node)) continue;

                const id = node.businessObject.id;
                const hasIncoming = flows.some(f => f.businessObject.targetRef?.id === id);
                const hasOutgoing = flows.some(f => f.businessObject.sourceRef?.id === id);

                if (!hasIncoming && !hasOutgoing) orphans.push(node);
            }

            if (orphans.length === 0) {
                return { level: LEVEL.SUCCESS, message: "Todos os elementos estão conectados." };
            }

            const names = orphans.slice(0, 3).map(describeElement).join(", ");
            const suffix = orphans.length > 3 ? ` e mais ${orphans.length - 3}` : "";

            return {
                level: LEVEL.WARNING,
                message: `${pluralize(orphans.length, "elemento isolado", "elementos isolados")}: ${names}${suffix}.`,
                hint: "Elementos sem conexão não participam do processo.",
                elements: orphans,
                fix: {
                    label: "Remover isolados",
                    fn: () => removeElements(orphans),
                },
            };
        },
    },

    // 5. Gateways com ramificação
    {
        id: "gateways-branching",
        run(registry) {
            const gateways = registry.filter(isGateway);
            if (gateways.length === 0) return null;

            const offenders = [];

            for (const gw of gateways) {
                const type = gw.businessObject.$type;
                const isBranching =
                    type === "bpmn:ExclusiveGateway" ||
                    type === "bpmn:InclusiveGateway" ||
                    type === "bpmn:ComplexGateway";
                if (!isBranching) continue;

                const outgoing = registry.filter(
                    (el) =>
                        el.businessObject?.$type === "bpmn:SequenceFlow" &&
                        el.businessObject.sourceRef?.id === gw.businessObject.id
                );
                const incoming = registry.filter(
                    (el) =>
                        el.businessObject?.$type === "bpmn:SequenceFlow" &&
                        el.businessObject.targetRef?.id === gw.businessObject.id
                );

                const isSplit = outgoing.length >= 2;
                const isMerge = incoming.length >= 2 && outgoing.length === 1;

                if (!isSplit && !isMerge) offenders.push(gw);
            }

            if (offenders.length === 0) {
                return { level: LEVEL.SUCCESS, message: "Gateways com ramificação correta." };
            }

            const names = offenders.slice(0, 2).map(describeElement).join(", ");
            const suffix = offenders.length > 2 ? ` e mais ${offenders.length - 2}` : "";

            return {
                level: LEVEL.WARNING,
                message: `Gateway sem função clara: ${names}${suffix}.`,
                hint: "Um gateway deve dividir o fluxo (2+ saídas) ou juntar ramos (2+ entradas).",
                elements: offenders,
            };
        },
    },

    // 6. Gateways nomeados
    {
        id: "gateways-named",
        run(registry) {
            const gateways = registry.filter(isGateway);
            if (gateways.length === 0) return null;

            const unnamed = gateways.filter(gw => !gw.businessObject.name?.trim());

            if (unnamed.length === 0) {
                return { level: LEVEL.SUCCESS, message: "Todos os gateways estão nomeados." };
            }

            const names = unnamed.slice(0, 3).map(describeElement).join(", ");
            const suffix = unnamed.length > 3 ? ` e mais ${unnamed.length - 3}` : "";

            return {
                level: LEVEL.WARNING,
                message: `${pluralize(unnamed.length, "gateway sem nome", "gateways sem nome")}: ${names}${suffix}.`,
                hint: "Nomeie as decisões (ex.: \"Aprovado?\", \"Valor > 1000?\").",
                elements: unnamed,
                fix: {
                    label: "Nomear",
                    fn: () => nameElements(unnamed, autoNameForGateway),
                },
            };
        },
    },

    // 7. Tarefas nomeadas
    {
        id: "tasks-named",
        run(registry) {
            const tasks = registry.filter(isTask);
            if (tasks.length === 0) return null;

            const unnamed = tasks.filter(t => !t.businessObject.name?.trim());

            if (unnamed.length === 0) {
                return { level: LEVEL.SUCCESS, message: "Todas as tarefas estão nomeadas." };
            }

            const names = unnamed.slice(0, 3).map(describeElement).join(", ");
            const suffix = unnamed.length > 3 ? ` e mais ${unnamed.length - 3}` : "";

            return {
                level: LEVEL.WARNING,
                message: `${pluralize(unnamed.length, "tarefa sem nome", "tarefas sem nome")}: ${names}${suffix}.`,
                hint: "Nomeie cada tarefa com um verbo no infinitivo.",
                elements: unnamed,
                fix: {
                    label: "Nomear",
                    fn: () => nameElements(unnamed, autoNameForTask),
                },
            };
        },
    },

    // 8. Fluxos de gateway nomeados
    {
        id: "gateway-flows-named",
        run(registry) {
            const gateways = registry.filter(isGateway);
            if (gateways.length === 0) return null;

            const gatewayIds = new Set(gateways.map(g => g.businessObject.id));
            const flows = getSequenceFlows(registry);
            const offenders = flows.filter(
                (f) =>
                    gatewayIds.has(f.businessObject.sourceRef?.id) &&
                    !f.businessObject.name?.trim()
            );

            if (offenders.length === 0) {
                return { level: LEVEL.SUCCESS, message: "Fluxos de gateway possuem condição." };
            }

            return {
                level: LEVEL.INFO,
                message: `${pluralize(offenders.length, "fluxo saindo de gateway sem condição", "fluxos saindo de gateway sem condição")}.`,
                hint: "Nomeie os fluxos com a condição (ex.: \"Sim\", \"Não\").",
                elements: offenders,
                fix: {
                    label: "Nomear",
                    fn: () => nameGatewayFlows(offenders),
                },
            };
        },
    },

    // 9. Evento inicial com saída
    {
        id: "start-has-outgoing",
        run(registry) {
            const starts = registry.filter(isStartEvent);
            if (starts.length === 0) return null;

            const flows = getSequenceFlows(registry);
            const deadEnds = starts.filter(s => {
                const id = s.businessObject.id;
                return !flows.some(f => f.businessObject.sourceRef?.id === id);
            });

            if (deadEnds.length === 0) return null;

            const names = deadEnds.map(describeElement).join(", ");

            return {
                level: LEVEL.ERROR,
                message: `Evento inicial sem saída: ${names}.`,
                hint: "O evento inicial precisa se conectar a algo.",
                elements: deadEnds,
            };
        },
    },

    // 10. Evento final com entrada
    {
        id: "end-has-incoming",
        run(registry) {
            const ends = registry.filter(isEndEvent);
            if (ends.length === 0) return null;

            const flows = getSequenceFlows(registry);
            const unreachable = ends.filter(e => {
                const id = e.businessObject.id;
                return !flows.some(f => f.businessObject.targetRef?.id === id);
            });

            if (unreachable.length === 0) return null;

            const names = unreachable.map(describeElement).join(", ");

            return {
                level: LEVEL.ERROR,
                message: `Evento final inalcançável: ${names}.`,
                hint: "O evento final precisa receber um fluxo.",
                elements: unreachable,
            };
        },
    },
];

// ------------------------------------------------------------
// Ações de correção
// ------------------------------------------------------------

function getRootElement() {
    try { return getCanvas()?.getRootElement(); } catch { return null; }
}

function createStartEvent() {
    const factory = getElementFactory();
    const modeling = getModeling();
    const root = getRootElement();
    if (!factory || !modeling || !root) throw new Error("Serviços indisponíveis.");

    const canvas = getCanvas();
    const vb = canvas.viewbox();
    const cx = vb.x + vb.width / 2 - 18;
    const cy = vb.y + vb.height / 2 - 18;

    const shape = factory.createShape({ type: "bpmn:StartEvent" });
    const created = modeling.createShape(shape, { x: cx, y: cy }, root);
    if (created) focusElement(created);
}

function createEndEvent() {
    const factory = getElementFactory();
    const modeling = getModeling();
    const root = getRootElement();
    if (!factory || !modeling || !root) throw new Error("Serviços indisponíveis.");

    const canvas = getCanvas();
    const vb = canvas.viewbox();
    const cx = vb.x + vb.width / 2 + 80 - 18;
    const cy = vb.y + vb.height / 2 + 60 - 18;

    const shape = factory.createShape({ type: "bpmn:EndEvent" });
    const created = modeling.createShape(shape, { x: cx, y: cy }, root);
    if (created) focusElement(created);
}

function removeElements(elements) {
    const modeling = getModeling();
    if (!modeling) throw new Error("Serviço modeling indisponível.");
    if (!elements || elements.length === 0) return;
    modeling.removeElements(elements);
}

function nameElements(elements, nameFn) {
    const modeling = getModeling();
    if (!modeling) throw new Error("Serviço modeling indisponível.");
    if (!elements || elements.length === 0) return;

    for (const el of elements) {
        const name = nameFn(el);
        if (name) modeling.updateProperties(el, { name });
    }
}

function nameGatewayFlows(flows) {
    const modeling = getModeling();
    if (!modeling) throw new Error("Serviço modeling indisponível.");
    if (!flows || flows.length === 0) return;

    const byGateway = new Map();
    for (const flow of flows) {
        const src = flow.businessObject.sourceRef?.id;
        if (!src) continue;
        if (!byGateway.has(src)) byGateway.set(src, []);
        byGateway.get(src).push(flow);
    }

    for (const group of byGateway.values()) {
        group.forEach((flow, i) => {
            const name = autoNameForFlow(flow, i);
            modeling.updateProperties(flow, { name });
        });
    }
}

// ------------------------------------------------------------
// Execução
// ------------------------------------------------------------

function evaluateRules(registry) {
    const report = [];

    for (const rule of RULES) {
        try {
            const result = rule.run(registry);
            if (result) report.push({ id: rule.id, ...result });
        } catch (err) {
            console.error(`[BPMN Studio] regra "${rule.id}" falhou:`, err);
            report.push({
                id: rule.id,
                level: LEVEL.ERROR,
                message: `Erro ao executar a regra "${rule.id}".`,
                hint: "Verifique o console para detalhes técnicos.",
            });
        }
    }

    return report;
}

function countByLevel(report) {
    const counts = {
        [LEVEL.ERROR]: 0,
        [LEVEL.WARNING]: 0,
        [LEVEL.INFO]: 0,
        [LEVEL.SUCCESS]: 0,
    };
    for (const item of report) {
        if (counts[item.level] !== undefined) counts[item.level]++;
    }
    return counts;
}

function getFilteredReport(report) {
    return report.filter((item) => state.activeFilters[item.level] !== false);
}

// ------------------------------------------------------------
// Render — toggles
// ------------------------------------------------------------

function renderFilters(counts) {
    if (!state.filtersEl) return;

    const order = [LEVEL.ERROR, LEVEL.WARNING, LEVEL.INFO, LEVEL.SUCCESS];

    const html = order.map((level) => {
        const meta = LEVEL_META[level];
        const count = counts[level] || 0;
        const active = state.activeFilters[level] !== false;
        const disabled = count === 0;

        return `
            <button type="button"
                class="validation-toggle validation-toggle--${level}"
                data-filter="${level}"
                aria-pressed="${active}"
                ${disabled ? "disabled" : ""}
                title="${meta.label}">
                <span class="validation-toggle__dot" aria-hidden="true"></span>
                <span>${meta.label}</span>
                <span class="validation-toggle__count">${count}</span>
            </button>
        `;
    }).join("");

    state.filtersEl.innerHTML = `
        ${html}
        <span class="validation__filters-spacer"></span>
        <button type="button" class="validation__filters-action" data-filter-action="all">Tudo</button>
        <button type="button" class="validation__filters-action" data-filter-action="none">Nada</button>
    `;

    state.filtersEl.querySelectorAll("[data-filter]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const level = btn.dataset.filter;
            state.activeFilters[level] = !state.activeFilters[level];
            renderReport(state.lastReport);
        });
    });

    state.filtersEl.querySelectorAll("[data-filter-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const value = btn.dataset.filterAction === "all";
            for (const level of order) {
                state.activeFilters[level] = value;
            }
            renderReport(state.lastReport);
        });
    });
}

// ------------------------------------------------------------
// Render — relatório
// ------------------------------------------------------------

function renderReport(report) {
    if (!state.listEl) return;

    state.lastReport = report;

    const counts = countByLevel(report);
    renderFilters(counts);

    const visible = getFilteredReport(report);
    state.listEl.innerHTML = "";

    if (report.length === 0) {
        const div = document.createElement("div");
        div.className = "validation-empty";
        div.innerHTML = `
            <span class="validation-empty__icon" aria-hidden="true">v</span>
            <span>Nenhuma verificação executada.</span>
        `;
        state.listEl.appendChild(div);
        updateSummary(counts, 0);
        return;
    }

    if (visible.length === 0) {
        const div = document.createElement("div");
        div.className = "validation-empty";
        div.innerHTML = `
            <span class="validation-empty__icon" aria-hidden="true">-</span>
            <span>Nada para mostrar com os filtros atuais.</span>
        `;
        state.listEl.appendChild(div);
        updateSummary(counts, 0);
        return;
    }

    for (const item of visible) {
        state.listEl.appendChild(buildItem(item));
    }

    updateSummary(counts, visible.length);
}

function buildItem(item) {
    const div = document.createElement("div");
    div.className = `validation-item validation-item--${item.level}`;

    const meta = LEVEL_META[item.level];
    const hasElements = Array.isArray(item.elements) && item.elements.length > 0;

    if (hasElements) div.classList.add("is-clickable");

    // Ícone (letra, sem emoji)
    const icon = document.createElement("span");
    icon.className = "validation-item__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = meta.icon;
    div.appendChild(icon);

    // Conteúdo
    const content = document.createElement("div");
    content.className = "validation-item__content";

    const msg = document.createElement("p");
    msg.className = "validation-item__message";
    msg.textContent = item.message;
    content.appendChild(msg);

    if (item.hint) {
        const hint = document.createElement("p");
        hint.className = "validation-item__hint";
        hint.textContent = item.hint;
        content.appendChild(hint);
    }

    div.appendChild(content);

    // Botão Resolver (texto puro)
    if (item.fix && typeof item.fix.fn === "function") {
        const actions = document.createElement("div");
        actions.className = "validation-item__actions";

        const fixBtn = document.createElement("button");
        fixBtn.type = "button";
        fixBtn.className = "validation-item__fix";
        fixBtn.textContent = item.fix.label || "Resolver";

        fixBtn.addEventListener("click", (e) => {
            e.stopPropagation();

            fixBtn.disabled = true;
            const originalText = fixBtn.textContent;
            fixBtn.textContent = "Aplicando...";

            try {
                item.fix.fn();

                state.notifications?.success?.(
                    "Correção aplicada",
                    item.fix.label || "O problema foi resolvido."
                );

                setTimeout(() => run(), 60);
            } catch (err) {
                console.error("[BPMN Studio] fix falhou:", err);
                state.notifications?.danger?.(
                    "Não foi possível resolver",
                    err?.message || "Erro desconhecido."
                );
                fixBtn.disabled = false;
                fixBtn.textContent = originalText;
            }
        });

        actions.appendChild(fixBtn);
        div.appendChild(actions);
    }

    // Clique no card → foca o primeiro elemento
    if (hasElements) {
        div.addEventListener("click", (e) => {
            if (e.target.closest("button")) return;
            focusElement(item.elements[0]);
        });
    }

    return div;
}

function updateSummary(counts, visibleCount) {
    if (!state.summaryEl) return;

    const parts = [];
    if (counts[LEVEL.ERROR] > 0)
        parts.push(pluralize(counts[LEVEL.ERROR], "erro", "erros"));
    if (counts[LEVEL.WARNING] > 0)
        parts.push(pluralize(counts[LEVEL.WARNING], "aviso", "avisos"));
    if (counts[LEVEL.INFO] > 0)
        parts.push(pluralize(counts[LEVEL.INFO], "info", "infos"));

    let text;
    if (parts.length === 0) {
        text = "Nenhum problema encontrado.";
    } else {
        text = parts.join(" · ");
        if (visibleCount === 0) text += " — filtrado";
    }

    state.summaryEl.textContent = text;

    if (state.panelEl) {
        state.panelEl.classList.toggle("has-errors", counts[LEVEL.ERROR] > 0);
        state.panelEl.classList.toggle(
            "has-warnings",
            counts[LEVEL.WARNING] > 0 && counts[LEVEL.ERROR] === 0
        );
        state.panelEl.classList.toggle(
            "is-valid",
            counts[LEVEL.ERROR] === 0 && counts[LEVEL.WARNING] === 0
        );
    }
}

// ------------------------------------------------------------
// API
// ------------------------------------------------------------

export function init(modeler, options = {}) {
    state.modeler = modeler;
    state.listEl = options.listEl || document.getElementById("validation-list");
    state.panelEl = options.panelEl || document.getElementById("validation");
    state.summaryEl = options.summaryEl || document.getElementById("validation-summary");
    state.notifications = options.notifications || null;

    if (!state.panelEl) {
        console.warn("[BPMN Studio] validator: painel #validation não encontrado.");
        return;
    }

    state.filtersEl = state.panelEl.querySelector(".validation__filters");

    if (!state.filtersEl) {
        state.filtersEl = document.createElement("div");
        state.filtersEl.className = "validation__filters";
        state.filtersEl.setAttribute("role", "toolbar");
        state.filtersEl.setAttribute("aria-label", "Filtros de validação");

        const header = state.panelEl.querySelector(".validation__header");
        if (header?.nextSibling) {
            state.panelEl.insertBefore(state.filtersEl, header.nextSibling);
        } else {
            state.panelEl.appendChild(state.filtersEl);
        }
    }

    if (!state.panelEl.classList.contains("is-open")) {
        state.panelEl.setAttribute("hidden", "");
    }

    const closeBtn = state.panelEl.querySelector("#validation-close");
    if (closeBtn && !closeBtn.dataset.bound) {
        closeBtn.dataset.bound = "1";
        closeBtn.addEventListener("click", () => close());
    }

    if (modeler && typeof modeler.on === "function") {
        const handler = () => { if (isOpen()) run(); };
        modeler.on("commandStack.changed", handler);
        state.listeners.push({ event: "commandStack.changed", handler });
        modeler.on("import.done", handler);
        state.listeners.push({ event: "import.done", handler });
    }

    if (isOpen()) run();

    console.info("[BPMN Studio] validator inicializado.");
}

export function run() {
    if (!state.modeler) return [];
    const registry = getRegistry();
    if (!registry) return [];
    const report = evaluateRules(registry);
    renderReport(report);
    return report;
}

export function open() {
    if (!state.panelEl) return;
    state.panelEl.classList.add("is-open");
    state.panelEl.removeAttribute("hidden");
    run();
}

export function close() {
    if (!state.panelEl) return;
    state.panelEl.classList.remove("is-open");
    state.panelEl.setAttribute("hidden", "");
}

export function toggle() {
    if (!state.panelEl) return;
    isOpen() ? close() : open();
}

export function isOpen() {
    return !!state.panelEl?.classList.contains("is-open");
}

export function summarize() {
    const counts = countByLevel(state.lastReport);
    if (counts[LEVEL.ERROR] > 0) return "error";
    if (counts[LEVEL.WARNING] > 0) return "warning";
    return "ok";
}

export function getReport() {
    return [...state.lastReport];
}