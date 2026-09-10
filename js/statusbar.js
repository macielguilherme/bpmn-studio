/* ============================================================
   BPMN Studio — js/statusbar.js
   Barra de status inferior.
   ============================================================ */

const state = {
    messageEl: null,
    zoomEl: null,
    countEl: null,
    indicatorEl: null,
    messageTimeout: null,
};

function formatZoom(value) {
    if (typeof value === "string") {
        if (value.trim().endsWith("%")) {
            const n = parseFloat(value);
            return Number.isFinite(n) ? n : 100;
        }
        value = parseFloat(value);
    }

    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 100;
    }

    const percent = value <= 5 ? value * 100 : value;
    return Math.round(percent);
}

export function init(dom = {}) {
    state.messageEl =
        dom.statusMessage || document.getElementById("status-message");

    state.zoomEl =
    dom.zoomLevel ||
    document.getElementById("zoom-level-status") ||
    document.getElementById("zoom-level");

    state.countEl =
        dom.elementCount || document.getElementById("element-count");

    state.indicatorEl =
        dom.statusIndicator || document.getElementById("status-indicator");

    setMessage("Pronto", { level: "info" });
    setZoom(1);
}

export function setMessage(text, options = {}) {
    if (!state.messageEl) return;

    if (state.messageTimeout) {
        clearTimeout(state.messageTimeout);
        state.messageTimeout = null;
    }

    state.messageEl.textContent = text || "";
    state.messageEl.dataset.state = options.level || "info";

    if (state.indicatorEl) {
        state.indicatorEl.dataset.state = options.level || "info";
    }

    const duration = options.duration ?? 0;
    if (duration > 0) {
        state.messageTimeout = setTimeout(() => {
            state.messageEl.textContent = "";
            state.messageEl.dataset.state = "";
            if (state.indicatorEl) state.indicatorEl.dataset.state = "";
        }, duration);
    }
}

export function clearMessage() {
    if (state.messageTimeout) {
        clearTimeout(state.messageTimeout);
        state.messageTimeout = null;
    }
    if (state.messageEl) {
        state.messageEl.textContent = "";
        state.messageEl.dataset.state = "";
    }
    if (state.indicatorEl) {
        state.indicatorEl.dataset.state = "";
    }
}

export function setZoom(value) {
    const percent = formatZoom(value);

    const topZoom = document.getElementById("zoom-level-status");
    const bottomZoom = document.getElementById("zoom-level");

    if (topZoom) {
        topZoom.textContent = `${percent}%`;
    }

    if (bottomZoom) {
        bottomZoom.textContent = `${percent}%`;
    }
}

export function setElementCount(count) {
    if (!state.countEl) return;

    const n = Number.isFinite(count) ? count : 0;
    state.countEl.textContent = `${n} ${n === 1 ? "elemento" : "elementos"}`;
}

export function getZoom() {
    if (!state.zoomEl) return 100;
    const n = parseInt(state.zoomEl.textContent, 10);
    return Number.isFinite(n) ? n : 100;
}

export function setBadge(badgeState) {
    if (!state.indicatorEl) return;
    state.indicatorEl.dataset.state = badgeState || "ok";
}
