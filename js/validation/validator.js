/* ============================================================
   BPMN Studio — js/validation/validator.js
   Validação estrutural básica do diagrama BPMN 2.0.
   V1: 5 regras fundamentais. Extensível via RULES.
   ============================================================ */

// ------------------------------------------------------------
// Estado do módulo (singleton)
// ------------------------------------------------------------
const state = {
    modeler: null,
    listEl: null,
    panelEl: null,
    notifications: null,
    listeners: [],
    lastReport: [],
};

// ------------------------------------------------------------
// Constantes de nível (espelham o CSS: data-level)
// ------------------------------------------------------------
const LEVEL = {
    SUCCESS: "success",
    WARNING: "warning",
    ERROR: "error",
    INFO: "info",
};

// ------------------------------------------------------------
// Acesso seguro ao registry do bpmn-js
// ------------------------------------------------------------
function getRegistry(modeler) {
    try {
        return modeler.get("elementRegistry");
    } catch (err) {
        console.warn("[BPMN Studio] elementRegistry indisponível:", err);
        return null;
    }
}

// ------------------------------------------------------------
// Helpers de classificação de elementos
// ------------------------------------------------------------
function isFlowNode(element) {
    if (!element || !element.businessObject) return false;
    const t = element.businessObject.$type;
    return (
        t.endsWith("Event") ||
        t.endsWith("Task") ||
        t.endsWith("Gateway") ||
        t === "bpmn:SubProcess" ||
        t === "bpmn:CallActivity"
    );
}

function isEvent(element) {
    return element?.businessObject?.$type?.endsWith("Event") || false;
}

function isStartEvent(element) {
    return element?.businessObject?.$type === "bpmn:StartEvent";
}

function isEndEvent(element) {
    return element?.businessObject?.$type === "bpmn:EndEvent";
}

function isGateway(element) {
    return element?.businessObject?.$type?.endsWith("Gateway") || false;
}

function getSequenceFlows(elementRegistry) {
    return elementRegistry.filter(
        (el) => el.businessObject?.$type === "bpmn:SequenceFlow"
    );
}

// ------------------------------------------------------------
// Regras de validação
// Cada regra recebe o elementRegistry e retorna um objeto:
//   { level, message, elementId? }
// ou null se a regra passa sem observação.
// ------------------------------------------------------------
const RULES = [
    // -------- Regra 1: precisa ter evento inicial --------
    {
        id: "has-start-event",
        run(registry) {
            const starts = registry.filter(isStartEvent);
            if (starts.length === 0) {
                return {
                    level: LEVEL.ERROR,
                    message: "O processo não possui um evento inicial (Start Event).",
                };
            }
            if (starts.length > 1) {
                return {
                    level: LEVEL.WARNING,
                    message: `O processo possui ${starts.length} eventos iniciais. Verifique se é intencional.`,
                };
            }
            return {
                level: LEVEL.SUCCESS,
                message: "Processo possui evento inicial.",
            };
        },
    },

    // -------- Regra 2: precisa ter evento final --------
    {
        id: "has-end-event",
        run(registry) {
            const ends = registry.filter(isEndEvent);
            if (ends.length === 0) {
                return {
                    level: LEVEL.ERROR,
                    message: "O processo não possui um evento final (End Event).",
                };
            }
            return {
                level: LEVEL.SUCCESS,
                message: "Processo possui evento final.",
            };
        },
    },

    // -------- Regra 3: fluxos conectados --------
    {
        id: "flows-connected",
        run(registry) {
            const flows = getSequenceFlows(registry);
            const broken = flows.filter(
                (f) => !f.businessObject.sourceRef || !f.businessObject.targetRef
            );

            if (broken.length > 0) {
                return {
                    level: LEVEL.ERROR,
                    message: `${broken.length} fluxo(s) de sequência sem origem ou destino definidos.`,
                };
            }

            if (flows.length === 0) {
                return {
                    level: LEVEL.WARNING,
                    message: "Nenhum fluxo de sequência foi definido no diagrama.",
                };
            }

            return {
                level: LEVEL.SUCCESS,
                message: "Fluxos estão conectados.",
            };
        },
    },

    // -------- Regra 4: nenhum elemento isolado --------
    {
        id: "no-orphans",
        run(registry) {
            const nodes = registry.filter(isFlowNode);
            const orphans = [];

            for (const node of nodes) {
                // Ignora Start/End (podem legitimamente ter só uma conexão).
                // Foca em tarefas e gateways, que PRECISAM ter entrada e saída.
                const t = node.businessObject.$type;
                const isTask = t.endsWith("Task") || t === "bpmn:SubProcess";
                const isGw = t.endsWith("Gateway");

                if (!isTask && !isGw) continue;

                const incoming = registry.filter(
                    (el) =>
                        el.businessObject?.$type === "bpmn:SequenceFlow" &&
                        el.businessObject.targetRef?.id === node.businessObject.id
                );
                const outgoing = registry.filter(
                    (el) =>
                        el.businessObject?.$type === "bpmn:SequenceFlow" &&
                        el.businessObject.sourceRef?.id === node.businessObject.id
                );

                if (incoming.length === 0 || outgoing.length === 0) {
                    orphans.push(node);
                }
            }

            if (orphans.length > 0) {
                const label = orphans
                    .slice(0, 3)
                    .map((o) => `"${o.businessObject.name || o.businessObject.$type}"`)
                    .join(", ");
                const suffix = orphans.length > 3 ? ` e mais ${orphans.length - 3}` : "";
                return {
                    level: LEVEL.WARNING,
                    message: `Elemento(s) isolado(s): ${label}${suffix}.`,
                };
            }

            return {
                level: LEVEL.SUCCESS,
                message: "Nenhum elemento está isolado.",
            };
        },
    },

    // -------- Regra 5: gateways com configuração suspeita --------
    {
        id: "gateways-sane",
        run(registry) {
            const gateways = registry.filter(isGateway);
            if (gateways.length === 0) {
                return {
                    level: LEVEL.SUCCESS,
                    message: "Nenhum gateway para revisar.",
                };
            }

            const suspicious = [];

            for (const gw of gateways) {
                const type = gw.businessObject.$type;
                const outgoing = registry.filter(
                    (el) =>
                        el.businessObject?.$type === "bpmn:SequenceFlow" &&
                        el.businessObject.sourceRef?.id === gw.businessObject.id
                );

                // Gateway exclusivo/inclusivo com menos de 2 saídas é suspeito.
                const isExclusive = type === "bpmn:ExclusiveGateway";
                const isInclusive = type === "bpmn:InclusiveGateway";

                if ((isExclusive || isInclusive) && outgoing.length < 2) {
                    suspicious.push(gw);
                }

                // Gateway sem nome dificulta leitura.
                if (!gw.businessObject.name || !gw.businessObject.name.trim()) {
                    suspicious.push(gw);
                }
            }

            if (suspicious.length > 0) {
                const unique = Array.from(
                    new Map(suspicious.map((s) => [s.id, s])).values()
                );
                const label = unique
                    .slice(0, 2)
                    .map((g) => `"${g.businessObject.name || g.businessObject.$type}"`)
                    .join(", ");
                const suffix = unique.length > 2 ? ` e mais ${unique.length - 2}` : "";
                return {
                    level: LEVEL.WARNING,
                    message: `Gateway(s) com configuração a revisar: ${label}${suffix}.`,
                };
            }

            return {
                level: LEVEL.SUCCESS,
                message: "Todos os gateways estão bem configurados.",
            };
        },
    },
];

// ------------------------------------------------------------
// Renderização do painel
// ------------------------------------------------------------
function renderReport(report) {
    if (!state.listEl) return;

    state.listEl.innerHTML = "";

    if (!report || report.length === 0) {
        const li = document.createElement("li");
        li.dataset.level = LEVEL.INFO;
        li.textContent = "Nenhuma verificação executada.";
        state.listEl.appendChild(li);
        return;
    }

    for (const item of report) {
        const li = document.createElement("li");
        li.dataset.level = item.level;

        // Guarda o elementId no DOM para uso futuro (clicar → focar no elemento)
        if (item.elementId) li.dataset.elementId = item.elementId;

        li.textContent = item.message;
        state.listEl.appendChild(li);
    }
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------
export function init(modeler, options = {}) {
    state.modeler = modeler;
    state.listEl = options.listEl || null;
    state.panelEl = options.panelEl || null;
    state.notifications = options.notifications || null;

    // Re-executa a validação sempre que o diagrama mudar
    // (mas NÃO reabre o painel automaticamente)
    if (modeler && typeof modeler.on === "function") {
        const handler = () => {
            if (state.panelEl && !state.panelEl.hidden) {
                run();
            }
        };
        modeler.on("commandStack.changed", handler);
        state.listeners.push({ event: "commandStack.changed", handler });
    }
}

export function destroy() {
    if (state.modeler && typeof state.modeler.off === "function") {
        for (const { event, handler } of state.listeners) {
            state.modeler.off(event, handler);
        }
    }
    state.listeners = [];
    state.modeler = null;
}

export function run() {
    if (!state.modeler) {
        console.warn("[BPMN Studio] validator.run() chamado sem modeler.");
        return [];
    }

    const registry = getRegistry(state.modeler);
    if (!registry) {
        return [];
    }

    const report = [];

    for (const rule of RULES) {
        try {
            const result = rule.run(registry);
            if (result) {
                report.push({ id: rule.id, ...result });
            }
        } catch (err) {
            console.error(`[BPMN Studio] regra "${rule.id}" falhou:`, err);
            report.push({
                id: rule.id,
                level: LEVEL.ERROR,
                message: `Erro interno na regra "${rule.id}".`,
            });
        }
    }

    state.lastReport = report;
    renderReport(report);

    return report;
}

export function open() {
    if (!state.panelEl) return;
    state.panelEl.hidden = false;
    run();
}

export function close() {
    if (!state.panelEl) return;
    state.panelEl.hidden = true;
}

export function toggle() {
    if (!state.panelEl) return;
    if (state.panelEl.hidden) {
        open();
    } else {
        close();
    }
}

export function getLastReport() {
    return state.lastReport;
}

// ------------------------------------------------------------
// Resumo do estado atual (útil para statusbar / badge)
// ------------------------------------------------------------
export function summarize() {
    const report = state.lastReport || [];
    const errors = report.filter((r) => r.level === LEVEL.ERROR).length;
    const warnings = report.filter((r) => r.level === LEVEL.WARNING).length;

    if (errors > 0) return "error";
    if (warnings > 0) return "warning";
    return "ok";
}