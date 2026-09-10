/* ============================================================
   BPMN Studio — js/main.js
   Bootstrap. Importa e inicializa todos os módulos na ordem.
   ============================================================ */

import * as modeler from "./modeler.js";
import * as palette from "./palette.js";
import * as properties from "./properties.js";
import * as toolbar from "./toolbar.js";
import * as notifications from "./notifications.js";
import * as statusbar from "./statusbar.js";
import * as validator from "./validator.js";
import * as newDiagram from "./newDiagram.js";
import * as exportBpmn from "./exportBpmn.js";
import * as importBpmn from "./importBpmn.js";

// ------------------------------------------------------------
// Constantes
// ------------------------------------------------------------

const APP_NAME = "BPMN Studio";
const APP_VERSION = "0.1.0";
const LOG = "[BPMN Studio]";

// ------------------------------------------------------------
// Estado global
// ------------------------------------------------------------

const state = {
    booted: false,
    currentFileName: null,
    hasUnsavedChanges: false,
};

// ------------------------------------------------------------
// Bootstrap
// ------------------------------------------------------------

async function boot() {
    console.info(`${LOG} v${APP_VERSION} — iniciando...`);

    if (typeof window.BpmnJS !== "function") {
        handleMissingBpmnJs();
        return;
    }

    installGlobalErrorHandlers();

    try {
        // 1. Notifications
        notifications.init(document.getElementById("notifications"));

        // 2. Statusbar
        statusbar.init({});

        // 3. Modeler
        modeler.init({
            container: "#canvas",
            statusbar,
            notifications,
        });

        const instance = modeler.getInstance();
        if (!instance) throw new Error("Falha ao criar instância do bpmn-js.");

        // 4. Palette
        palette.init(instance, { container: document.getElementById("palette-container") });

        // 5. Properties
        properties.init(instance, {
            bodyEl: document.getElementById("properties-body"),
            titleEl: document.getElementById("properties-title"),
        });

        // 6. Validator (ANTES do toolbar)
        validator.init(instance, {
            listEl: document.getElementById("validation-list"),
            panelEl: document.getElementById("validation"),
            summaryEl: document.getElementById("validation-summary"),
            notifications,
        });

        // 7. Toolbar (precisa do validator já inicializado)
        const io = {
            newDiagram: () => newDiagram.run(instance, { confirm: true }),
            exportBpmn: (format) => exportBpmn.run(instance, format),
            importBpmn: (file) => importBpmn.run(instance, file),
        };

        toolbar.init({
            modeler,
            instance,
            io,
            statusbar,
            notifications,
            validator,
        });

        // 8. Diagrama inicial
        try {
            await newDiagram.run(instance, { confirm: false });
        } catch (err) {
            console.warn(`${LOG} aviso ao criar diagrama inicial:`, err);
        }

        // 9. Estado "dirty"
        instance.on("commandStack.changed", () => {
            state.hasUnsavedChanges = true;
            statusbar.setMessage("Alterações não salvas", { level: "warning" });
        });

        // 10. Contagem de elementos inicial
        updateElementCount();

        state.booted = true;

        notifications.success(
            `${APP_NAME} pronto`,
            "Crie um processo arrastando elementos da barra lateral."
        );

        statusbar.setMessage(`v${APP_VERSION} — pronto`, { level: "success" });

        console.info(`${LOG} inicializado com sucesso.`);
    } catch (err) {
        console.error(`${LOG} falha na inicialização:`, err);

        notifications.danger(
            "Falha ao iniciar",
            err?.message || "Erro desconhecido."
        );
    } finally {
        exposeDebugApi();
    }
}

// ------------------------------------------------------------
// Utilitários internos
// ------------------------------------------------------------

function updateElementCount() {
    try {
        const count = modeler.getElementCount();
        statusbar.setElementCount(count);
    } catch {
        // silencioso
    }
}

function handleMissingBpmnJs() {
    console.error(`${LOG} bpmn-js não carregado (CDN indisponível).`);

    document.body.innerHTML = `
        <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:32px;background:#f8fafc;color:#0f172a;font-family:system-ui,sans-serif;text-align:center;">
            <div style="max-width:480px;">
                <h1 style="margin:0 0 12px;font-size:20px;">${APP_NAME}</h1>
                <p style="color:#475569;line-height:1.6;">
                    Não foi possível carregar o motor de modelagem BPMN.
                    Verifique sua conexão com a internet.
                </p>
                <button onclick="location.reload()"
                    style="margin-top:16px;padding:10px 20px;background:#2563eb;color:#fff;border:0;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;">
                    Tentar novamente
                </button>
            </div>
        </div>
    `;
}

function installGlobalErrorHandlers() {
    const NOISE = [
        "Could not establish connection",
        "Receiving end does not exist",
        "MetaMask",
        "contentscript",
    ];

    function isNoise(value) {
        if (!value) return false;
        const str =
            typeof value === "string"
                ? value
                : value?.message || value?.reason?.message || "";
        return NOISE.some((k) => str.toLowerCase().includes(k.toLowerCase()));
    }

    window.addEventListener("error", (event) => {
        if (isNoise(event.error || event.message)) return;
        console.error(`${LOG} erro:`, event.error || event.message);
    });

    window.addEventListener("unhandledrejection", (event) => {
        if (isNoise(event.reason)) return;
        console.error(`${LOG} promise rejeitada:`, event.reason);
    });

    window.addEventListener("beforeunload", (event) => {
        if (state.hasUnsavedChanges) {
            event.preventDefault();
            event.returnValue = "";
        }
    });
}

function exposeDebugApi() {
    const instance = modeler.getInstance();

    window.BPMNStudio = {
        version: APP_VERSION,
        state,
        modeler: instance,
        notifications,
        statusbar,
        validator,
        palette,
        properties,
        toolbar,
        newDiagram,
        exportBpmn,
        importBpmn,

        async exportXml() {
            return exportBpmn.toXml(instance);
        },

        async importXml(xml) {
            return importBpmn.fromString(instance, xml);
        },

        resetDirty() {
            state.hasUnsavedChanges = false;
        },
    };

    console.info(`${LOG} API de debug em window.BPMNStudio`);
}

// ------------------------------------------------------------
// Ponto de entrada
// ------------------------------------------------------------

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}