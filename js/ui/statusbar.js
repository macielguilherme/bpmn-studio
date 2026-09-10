/* ============================================================
   BPMN Studio — js/ui/statusbar.js
   Controle da barra de status inferior (zoom, badge, mensagem).
   ============================================================ */

// ------------------------------------------------------------
// Estado do módulo (singleton)
// ------------------------------------------------------------
const state = {
    zoomEl: null,
    messageEl: null,
    badgeEl: null,
    messageTimeout: null,
    defaultMessageDuration: 0, // 0 = persistente até ser trocada
};

// ------------------------------------------------------------
// Níveis de mensagem (mapeiam para classes CSS)
// ------------------------------------------------------------
const LEVELS = ["info", "success", "warning", "error"];

// ------------------------------------------------------------
// Helpers internos
// ------------------------------------------------------------
function isValidLevel(level) {
    return LEVELS.includes(level);
}

function formatZoom(value) {
    // Aceita:
    //   - número em escala unitária (1.0 = 100%)
    //   - número em percentual (100 = 100%)
    //   - string "100%" ou "1.0"
    if (typeof value === "string") {
        if (value.trim().endsWith("%")) {
            const n = parseFloat(value);
            return Number.isFinite(n) ? n : 100;
        }
        const n = parseFloat(value);
        if (!Number.isFinite(n)) return 100;
        value = n;
    }

    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 100;
    }

    // Heurística: se value <= 5, assume escala unitária (1.0 = 100%)
    const percent = value <= 5 ? value * 100 : value;
    return Math.round(percent);
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

/**
 * Inicializa o módulo. `dom` deve conter:
 *   - zoomLevel  → #zoom-level
 *   - statusMessage → #status-message
 *   - bpmnBadge → #bpmn-badge
 */
export function init(dom = {}) {
    state.zoomEl = dom.zoomLevel || document.getElementById("zoom-level");
    state.messageEl = dom.statusMessage || document.getElementById("status-message");
    state.badgeEl = dom.bpmnBadge || document.getElementById("bpmn-badge");
}

/**
 * Atualiza o indicador de zoom.
 * Aceita 1.0 (100%), 100 (100%) ou "100%".
 */
export function setZoom(value) {
    if (!state.zoomEl) return;
    const percent = formatZoom(value);
    state.zoomEl.textContent = `${percent}%`;
}

/**
 * Retorna o zoom atual em percentual (inteiro).
 */
export function getZoom() {
    if (!state.zoomEl) return 100;
    const n = parseInt(state.zoomEl.textContent, 10);
    return Number.isFinite(n) ? n : 100;
}

/**
 * Define a mensagem de status.
 * @param {string} text
 * @param {object} [options]
 * @param {string} [options.level="info"]  → "info" | "success" | "warning" | "error"
 * @param {number} [options.duration=0]    → ms até limpar (0 = persistente)
 */
export function setMessage(text, options = {}) {
    if (!state.messageEl) return;

    const level = isValidLevel(options.level) ? options.level : "info";

    // Cancela timeout anterior
    if (state.messageTimeout) {
        clearTimeout(state.messageTimeout);
        state.messageTimeout = null;
    }

    // Limpa classes antigas de nível
    state.messageEl.classList.remove(
        "statusbar__message--info",
        "statusbar__message--success",
        "statusbar__message--warning",
        "statusbar__message--error"
    );

    state.messageEl.textContent = text || "";
    state.messageEl.dataset.level = level;

    if (text) {
        state.messageEl.classList.add(`statusbar__message--${level}`);
    }

    // Auto-clear opcional
    const duration = options.duration ?? state.defaultMessageDuration;
    if (duration > 0) {
        state.messageTimeout = setTimeout(() => {
            clearMessage();
        }, duration);
    }
}

/**
 * Limpa a mensagem e volta ao estado neutro.
 */
export function clearMessage() {
    if (state.messageTimeout) {
        clearTimeout(state.messageTimeout);
        state.messageTimeout = null;
    }
    if (!state.messageEl) return;
    state.messageEl.textContent = "";
    state.messageEl.dataset.level = "";
    state.messageEl.classList.remove(
        "statusbar__message--info",
        "statusbar__message--success",
        "statusbar__message--warning",
        "statusbar__message--error"
    );
}

/**
 * Define o estado do badge BPMN.
 * @param {"ok"|"warning"|"error"} state
 */
export function setBadge(badgeState) {
    if (!state.badgeEl) return;

    const valid = ["ok", "warning", "error"];
    const s = valid.includes(badgeState) ? badgeState : "ok";

    state.badgeEl.dataset.state = s;

    // Texto varia por estado (mantém o "BPMN 2.0" mas troca o símbolo)
    const symbols = { ok: "✓", warning: "⚠", error: "✕" };
    state.badgeEl.textContent = `BPMN 2.0 ${symbols[s]}`;

    // Título acessível
    const titles = {
        ok: "Diagrama compatível com BPMN 2.0",
        warning: "Diagrama possui avisos de validação",
        error: "Diagrama possui erros de validação",
    };
    state.badgeEl.title = titles[s];
}

/**
 * Retorna o estado atual do badge.
 */
export function getBadge() {
    if (!state.badgeEl) return "ok";
    return state.badgeEl.dataset.state || "ok";
}