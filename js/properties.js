/* ============================================================
   BPMN Studio — js/properties.js
   Painel de propriedades do elemento selecionado.
   ============================================================ */

const state = {
    modeler: null,
    bodyEl: null,
    titleEl: null,
    listeners: [],
    current: null,
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function getBusinessObject(el) {
    return el?.businessObject || null;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------

function renderEmpty() {
    if (!state.bodyEl) return;

    state.bodyEl.innerHTML = `
        <div id="properties-empty" class="properties-empty">
            <div class="properties-empty__icon" aria-hidden="true">◇</div>
            <h3 class="properties-empty__title">Nenhum elemento selecionado</h3>
            <p class="properties-empty__text">
                Selecione um elemento do diagrama para visualizar
                e editar suas propriedades.
            </p>
        </div>
    `;

    if (state.titleEl) state.titleEl.textContent = "Propriedades";
}

function renderElement(el) {
    if (!state.bodyEl) return;

    const bo = getBusinessObject(el);
    if (!bo) {
        renderEmpty();
        return;
    }

    const type = bo.$type?.replace("bpmn:", "") || "Elemento";
    const name = bo.name || "";
    const id = bo.id || "";

    if (state.titleEl) state.titleEl.textContent = name || type;

    state.bodyEl.innerHTML = `
        <div class="properties-element">
            <div class="properties-element__type">${escapeHtml(type)}</div>
            <div class="properties-element__name">${escapeHtml(name || "(sem nome)")}</div>
        </div>

        <section class="properties-section">
            <div class="properties-section__content">
                <div class="properties-group">
                    <label class="properties-label" for="prop-name">Nome</label>
                    <input id="prop-name" class="property-input" type="text"
                        value="${escapeHtml(name)}" placeholder="Nome do elemento">
                </div>

                <div class="properties-group">
                    <label class="properties-label" for="prop-id">ID</label>
                    <input id="prop-id" class="property-input" type="text"
                        value="${escapeHtml(id)}" readonly>
                </div>
            </div>
        </section>
    `;

    const nameInput = state.bodyEl.querySelector("#prop-name");
    if (nameInput) {
        nameInput.addEventListener("change", (e) => {
            const newName = e.target.value;
            try {
                const modeling = state.modeler.get("modeling");
                modeling.updateProperties(el, { name: newName });
            } catch (err) {
                console.error("[BPMN Studio] erro ao renomear:", err);
            }
        });
    }
}

// ------------------------------------------------------------
// API
// ------------------------------------------------------------

export function init(modeler, options = {}) {
    state.modeler = modeler;
    state.bodyEl = options.bodyEl || document.getElementById("properties-body");
    state.titleEl = options.titleEl || document.getElementById("properties-title");

    if (!state.modeler) {
        console.warn("[BPMN Studio] properties: modeler ausente.");
        return;
    }

    const handler = (event) => {
        const selection = event?.newSelection || [];

        if (selection.length === 0) {
            state.current = null;
            renderEmpty();
            return;
        }

        const el = selection[0];
        state.current = el;
        renderElement(el);
    };

    state.modeler.on("selection.changed", handler);
    state.listeners.push({ event: "selection.changed", handler });

    renderEmpty();

    console.info("[BPMN Studio] properties inicializado.");
}

export function destroy() {
    if (state.modeler && typeof state.modeler.off === "function") {
        for (const { event, handler } of state.listeners) {
            try {
                state.modeler.off(event, handler);
            } catch {
                // silencioso
            }
        }
    }
    state.listeners = [];
    state.modeler = null;
}