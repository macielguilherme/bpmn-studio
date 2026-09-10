/* ============================================================
   BPMN Studio — main.js
   Bootstrap da aplicação. Importa e inicializa todos os módulos
   na ordem correta de dependência.
   ============================================================ */

// ------------------------------------------------------------
// Imports — ordem de dependência (de baixo para cima)
// ------------------------------------------------------------
import * as notifications from "./ui/notifications.js";
import * as statusbar from "./ui/statusbar.js";
import * as modeler from "./editor/modeler.js";
import * as palette from "./editor/palette.js";
import * as properties from "./editor/properties.js";
import * as toolbar from "./ui/toolbar.js";
import * as newDiagram from "./io/newDiagram.js";
import * as exportBpmn from "./io/exportBpmn.js";
import * as importBpmn from "./io/importBpmn.js";
import * as validator from "./validation/validator.js";

// ------------------------------------------------------------
// Constantes de ambiente
// ------------------------------------------------------------
const APP_NAME = "BPMN Studio";
const APP_VERSION = "0.1.0";
const LOG_PREFIX = "[BPMN Studio]";

// ------------------------------------------------------------
// Estado global da aplicação
// ------------------------------------------------------------
const state = {
    booted: false,
    modelerReady: false,
    currentFileName: null,
    hasUnsavedChanges: false,
};

// ------------------------------------------------------------
// Bootstrap
// ------------------------------------------------------------
function boot() {
    console.info(`${LOG_PREFIX} v${APP_VERSION} — iniciando...`);

    // 1) Verifica pré-requisito crítico: bpmn-js carregado via CDN?
    if (typeof window.BpmnJS !== "function") {
        handleMissingBpmnJs();
        return;
    }

    // 2) Trava erros globais ANTES de inicializar qualquer coisa
    installGlobalErrorHandlers();

    // 3) Captura elementos-chave do DOM
    const dom = captureDom();
    if (!dom) return;

    // 4) Inicializa subsistemas na ordem de dependência
    initSubsystems(dom)
        .then(() => {
            state.booted = true;
            state.modelerReady = true;

            notifications.success(
                `${APP_NAME} pronto`,
                "Crie um processo arrastando elementos da barra lateral."
            );

            statusbar.setMessage(`v${APP_VERSION} — pronto para modelar`);
            statusbar.setBadge("ok");

            console.info(`${LOG_PREFIX} inicializado com sucesso.`);
        })
        .catch((err) => {
            console.error(`${LOG_PREFIX} falha na inicialização:`, err);
            notifications.danger(
                "Falha ao iniciar",
                err?.message || "Erro desconhecido. Veja o console."
            );
        })
        .finally(() => {
            // 5) Expõe para debug no console (independente de sucesso/erro)
            exposeDebugApi(dom);
        });
}

// ------------------------------------------------------------
// Captura de elementos do DOM
// ------------------------------------------------------------
function captureDom() {
    const dom = {
        canvas: document.getElementById("canvas"),
        toolbar: document.getElementById("toolbar"),
        sidebar: document.getElementById("sidebar"),
        properties: document.getElementById("properties"),
        propertiesBody: document.getElementById("properties-body"),
        statusbar: document.getElementById("statusbar"),
        statusMessage: document.getElementById("status-message"),
        zoomLevel: document.getElementById("zoom-level"),
        bpmnBadge: document.getElementById("bpmn-badge"),
        fileInput: document.getElementById("file-input"),
        notifications: document.getElementById("notifications"),
        validation: document.getElementById("validation"),
        validationList: document.getElementById("validation-list"),
    };

    const required = ["canvas", "toolbar", "sidebar", "properties", "statusbar"];
    const missing = required.filter((key) => !dom[key]);

    if (missing.length > 0) {
        const msg = `Elementos obrigatórios ausentes no DOM: ${missing.join(", ")}`;
        console.error(`${LOG_PREFIX} ${msg}`);
        alert(`${APP_NAME}: ${msg}`);
        return null;
    }

    return dom;
}

// ------------------------------------------------------------
// Inicialização dos subsistemas (ordem importa!)
// ------------------------------------------------------------
async function initSubsystems(dom) {
    // 1. Notifications primeiro — todo o resto pode querer avisar o usuário
    notifications.init(dom.notifications);

    // 2. Statusbar — feedback contínuo
    statusbar.init(dom);

    // 3. Modeler — coração do app (instancia bpmn-js)
    //    Passamos o statusbar para sincronizar zoom automaticamente.
    modeler.init(dom.canvas, { statusbar });
    const modelerInstance = modeler.getInstance();

    if (!modelerInstance) {
        throw new Error("Falha ao criar instância do bpmn-js.");
    }

    // 4. Palette (sidebar) — depende do modeler estar pronto
    palette.init(modelerInstance);

    // 5. Properties panel — depende do modeler
    properties.init(modelerInstance);

    // 6. IO — funções puras que recebem o modeler por parâmetro
    const io = {
        newDiagram: () => newDiagram.run(modelerInstance, { confirm: true }),
        exportBpmn: (format) => exportBpmn.run(modelerInstance, format),
        importBpmn: (file) => importBpmn.run(modelerInstance, file),
    };

    // 7. Toolbar — recebe tudo que precisa para orquestrar
    toolbar.init({
        dom,
        modeler: modelerInstance,
        io,
        statusbar,
        notifications,
    });

    // 8. Validator — stub na V1, mas já inicializado
    validator.init(modelerInstance, {
        listEl: dom.validationList,
        panelEl: dom.validation,
        notifications,
    });

    // 9. Carrega um diagrama inicial (vazio, com Start Event)
    //    Envolvido com try/catch próprio para não abortar o boot se
    //    houver um warning do bpmn-js.
    try {
        await newDiagram.run(modelerInstance, { confirm: false });
    } catch (err) {
        console.warn(`${LOG_PREFIX} aviso ao criar diagrama inicial:`, err);
    }

    // 10. Marca alterações não salvas a cada mudança no modeler
    modelerInstance.on("commandStack.changed", () => {
        state.hasUnsavedChanges = true;
        statusbar.setMessage("Alterações não salvas");
    });
}

// ------------------------------------------------------------
// Tratamento de CDN indisponível
// ------------------------------------------------------------
function handleMissingBpmnJs() {
    const msg =
        "A biblioteca bpmn-js não foi carregada. " +
        "Verifique sua conexão com a internet ou se o CDN (unpkg) está acessível.";

    console.error(`${LOG_PREFIX} ${msg}`);

    const banner = document.createElement("div");
    banner.style.cssText = `
        position: fixed; inset: 0; z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        background: #f8fafc; color: #0f172a;
        font-family: system-ui, sans-serif; padding: 24px; text-align: center;
    `;
    banner.innerHTML = `
        <div style="max-width: 480px;">
            <h1 style="margin: 0 0 12px; font-size: 20px;">${APP_NAME}</h1>
            <p style="margin: 0 0 16px; line-height: 1.6; color: #475569;">
                Não foi possível carregar o motor de modelagem BPMN.
            </p>
            <p style="margin: 0 0 24px; line-height: 1.6; color: #475569;">
                ${msg}
            </p>
            <button onclick="location.reload()"
                style="padding: 10px 20px; background: #3b5bdb; color: white;
                       border: none; border-radius: 6px; cursor: pointer;
                       font-size: 14px; font-weight: 500;">
                Tentar novamente
            </button>
        </div>
    `;
    document.body.appendChild(banner);
}

// ------------------------------------------------------------
// Handlers globais de erro
// ------------------------------------------------------------
function installGlobalErrorHandlers() {
    // Palavras-chave que indicam erro de extensão de navegador
    // (MetaMask, etc.) — não são do nosso app, então filtramos.
    const EXTENSION_NOISE = [
        "Could not establish connection",
        "Receiving end does not exist",
        "MetaMask",
        "extension",
        "contentscript",
    ];

    function isExtensionNoise(value) {
        if (!value) return false;
        const str =
            typeof value === "string"
                ? value
                : value?.message || value?.reason?.message || "";
        return EXTENSION_NOISE.some((kw) =>
            str.toLowerCase().includes(kw.toLowerCase())
        );
    }

    window.addEventListener("error", (event) => {
        if (isExtensionNoise(event.error || event.message)) return;
        console.error(`${LOG_PREFIX} erro não capturado:`, event.error || event.message);
    });

    window.addEventListener("unhandledrejection", (event) => {
        if (isExtensionNoise(event.reason)) return;
        console.error(`${LOG_PREFIX} promise rejeitada sem tratamento:`, event.reason);
    });

    // Aviso ao sair com alterações não salvas
    window.addEventListener("beforeunload", (event) => {
        if (state.hasUnsavedChanges) {
            event.preventDefault();
            event.returnValue = "";
        }
    });
}

// ------------------------------------------------------------
// API de debug exposta em window.BPMNStudio
// ------------------------------------------------------------
function exposeDebugApi(dom) {
    window.BPMNStudio = {
        version: APP_VERSION,
        state,
        dom,
        modeler: modeler.getInstance(),
        // Módulos completos (para debug e para o toolbar chamar)
        notifications,
        statusbar,
        validator,
        palette,
        properties,
        toolbar,
        newDiagram,
        exportBpmn,
        importBpmn,
        // Helpers úteis no console:
        async exportXml() {
            return exportBpmn.toXml(modeler.getInstance());
        },
        async importXml(xml) {
            return importBpmn.fromString(modeler.getInstance(), xml);
        },
        resetDirty() {
            state.hasUnsavedChanges = false;
            statusbar.setMessage("");
        },
    };

    console.info(
        `${LOG_PREFIX} API de debug disponível em window.BPMNStudio`
    );
}

// ------------------------------------------------------------
// Ponto de entrada
// ------------------------------------------------------------
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}