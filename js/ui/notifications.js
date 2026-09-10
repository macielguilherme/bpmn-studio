/* ============================================================
   BPMN Studio — js/ui/notifications.js
   Sistema de toasts. Substitui alert()/console por feedback visual.
   ============================================================ */

// ------------------------------------------------------------
// Estado do módulo (singleton)
// ------------------------------------------------------------
const state = {
    container: null,
    defaultDuration: 4000,
    maxVisible: 4,
};

// ------------------------------------------------------------
// Helpers internos
// ------------------------------------------------------------

/**
 * Garante que o container existe. Se `init()` não foi chamado ainda,
 * cria um container de fallback no body (defensivo).
 */
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

/**
 * Remove os toasts mais antigos se passar do limite de visíveis.
 */
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

/**
 * Remove um toast do DOM com animação de saída.
 */
function dismiss(toastEl) {
    if (!toastEl || !toastEl.parentNode) return;
    toastEl.style.transition = "opacity 120ms ease, transform 120ms ease";
    toastEl.style.opacity = "0";
    toastEl.style.transform = "translateY(8px)";
    setTimeout(() => {
        if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    }, 120);
}

/**
 * Cria e insere um toast no DOM.
 */
function createToast(level, title, message, options = {}) {
    const container = ensureContainer();
    enforceMaxVisible();

    const toast = document.createElement("div");
    toast.className = `toast toast--${level}`;
    toast.setAttribute("role", level === "danger" ? "alert" : "status");

    // Conteúdo
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

    // Botão de fechar (só se o usuário puder fechar manualmente)
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

    // Auto-dismiss
    const duration = options.duration ?? state.defaultDuration;
    if (duration > 0) {
        setTimeout(() => dismiss(toast), duration);
    }

    return toast;
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

/**
 * Inicializa o módulo com o container de notificações.
 * Deve ser chamado uma única vez no boot (main.js).
 */
export function init(containerEl) {
    if (containerEl) {
        state.container = containerEl;
    } else {
        ensureContainer();
    }
}

/**
 * Toast de sucesso (verde).
 */
export function success(title, message, options) {
    return createToast("success", title, message, options);
}

/**
 * Toast de aviso (amarelo).
 */
export function warning(title, message, options) {
    return createToast("warning", title, message, options);
}

/**
 * Toast de erro (vermelho). Permanece visível por mais tempo por padrão.
 */
export function danger(title, message, options = {}) {
    const merged = { duration: 7000, ...options };
    return createToast("danger", title, message, merged);
}

/**
 * Toast de informação (azul).
 */
export function info(title, message, options) {
    return createToast("info", title, message, options);
}

/**
 * Remove todos os toasts visíveis.
 */
export function clear() {
    const container = ensureContainer();
    const toasts = container.querySelectorAll(".toast");
    toasts.forEach((t) => dismiss(t));
}

/**
 * Retorna o número de toasts visíveis (útil para testes).
 */
export function count() {
    const container = ensureContainer();
    return container.querySelectorAll(".toast").length;
}