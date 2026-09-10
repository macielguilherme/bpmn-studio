/* ============================================================
   BPMN Studio — js/notifications.js
   Sistema de toasts.
   ============================================================ */

const state = {
    container: null,
    defaultDuration: 4000,
    maxVisible: 4,
};

function ensureContainer() {
    if (state.container && document.body.contains(state.container)) {
        return state.container;
    }

    let el = document.getElementById("notifications");
    if (!el) {
        el = document.createElement("div");
        el.id = "notifications";
        el.className = "notifications";
        el.setAttribute("aria-live", "polite");
        el.setAttribute("aria-atomic", "true");
        document.body.appendChild(el);
    }
    state.container = el;
    return el;
}

function enforceMaxVisible() {
    const container = ensureContainer();
    const toasts = container.querySelectorAll(".toast");

    if (toasts.length >= state.maxVisible) {
        const excess = toasts.length - state.maxVisible + 1;
        for (let i = 0; i < excess; i++) {
            dismiss(toasts[i]);
        }
    }
}

function dismiss(toastEl) {
    if (!toastEl || !toastEl.parentNode) return;

    toastEl.style.transition = "opacity 120ms ease, transform 120ms ease";
    toastEl.style.opacity = "0";
    toastEl.style.transform = "translateY(8px)";

    setTimeout(() => {
        if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    }, 120);
}

function createToast(level, title, message, options = {}) {
    const container = ensureContainer();
    enforceMaxVisible();

    const toast = document.createElement("div");
    toast.className = `toast toast--${level}`;
    toast.setAttribute("role", level === "danger" ? "alert" : "status");

    const content = document.createElement("div");
    content.className = "toast__content";

    const titleEl = document.createElement("span");
    titleEl.className = "toast__title";
    titleEl.textContent = title;
    content.appendChild(titleEl);

    if (message) {
        const msgEl = document.createElement("span");
        msgEl.textContent = message;
        content.appendChild(msgEl);
    }

    toast.appendChild(content);

    if (options.dismissible !== false) {
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "toast__close";
        closeBtn.setAttribute("aria-label", "Fechar notificação");
        closeBtn.textContent = "×";
        closeBtn.addEventListener("click", () => dismiss(toast));
        toast.appendChild(closeBtn);
    }

    container.appendChild(toast);

    const duration = options.duration ?? state.defaultDuration;
    if (duration > 0) {
        setTimeout(() => dismiss(toast), duration);
    }

    return toast;
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

export function init(containerEl) {
    if (containerEl) {
        state.container = containerEl;
    } else {
        ensureContainer();
    }
}

export function success(title, message, options) {
    return createToast("success", title, message, options);
}

export function warning(title, message, options) {
    return createToast("warning", title, message, options);
}

export function danger(title, message, options = {}) {
    return createToast("danger", title, message, { duration: 7000, ...options });
}

export function info(title, message, options) {
    return createToast("info", title, message, options);
}

export function error(title, message, options) {
    return danger(title, message, options);
}

export function clear() {
    const container = ensureContainer();
    container.querySelectorAll(".toast").forEach((t) => dismiss(t));
}

export function count() {
    return ensureContainer().querySelectorAll(".toast").length;
}