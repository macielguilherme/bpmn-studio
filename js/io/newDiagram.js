/* ============================================================
   BPMN Studio — js/io/newDiagram.js
   Cria um diagrama BPMN 2.0 vazio mas válido, com um Start Event
   centralizado. Substitui o conteúdo atual do modeler.
   ============================================================ */

// ------------------------------------------------------------
// Constantes
// ------------------------------------------------------------
const DEFAULT_PROCESS_ID = "Process_1";
const DEFAULT_PROCESS_NAME = "Novo Processo";
const DEFAULT_START_ID = "StartEvent_1";
const DEFAULT_START_NAME = "Início";

const START_EVENT_SIZE = 36;
const START_EVENT_POS = { x: 180, y: 160 };

// ------------------------------------------------------------
// Geração do XML BPMN 2.0 inicial
// ------------------------------------------------------------

function generateSuffix() {
    return Date.now().toString(36).slice(-6);
}

/**
 * Monta o XML BPMN 2.0 inicial.
 * Inclui os namespaces obrigatórios e a seção BPMNDI completa.
 *
 * IMPORTANTE: NÃO incluímos <bpmn:outgoing> no Start Event porque
 * ele aponta para um SequenceFlow que não existe — isso gera warning
 * no bpmn-js 17.x. O bpmn-js regenera esse atributo automaticamente
 * quando o usuário conectar o Start Event a outro elemento.
 */
function buildInitialXml(options = {}) {
    const suffix = options.suffix || generateSuffix();
    const processId = options.processId || `${DEFAULT_PROCESS_ID}_${suffix}`;
    const processName = options.processName || DEFAULT_PROCESS_NAME;
    const startId = options.startId || `${DEFAULT_START_ID}_${suffix}`;
    const startName = options.startName || DEFAULT_START_NAME;

    const { x, y } = START_EVENT_POS;
    const size = START_EVENT_SIZE;

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_${suffix}"
                  targetNamespace="http://bpmn.io/schema/bpmn"
                  exporter="BPMN Studio"
                  exporterVersion="0.1.0">
  <bpmn:process id="${processId}" name="${escapeXml(processName)}" isExecutable="false">
    <bpmn:startEvent id="${startId}" name="${escapeXml(startName)}" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_${suffix}">
    <bpmndi:BPMNPlane id="BPMNPlane_${suffix}" bpmnElement="${processId}">
      <bpmndi:BPMNShape id="BPMNShape_${startId}" bpmnElement="${startId}">
        <dc:Bounds x="${x}" y="${y}" width="${size}" height="${size}" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="${x - 10}" y="${y + size + 8}" width="56" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

function escapeXml(str) {
    if (typeof str !== "string") return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

// ------------------------------------------------------------
// Núcleo
// ------------------------------------------------------------

async function doCreate(modeler, options = {}) {
    if (!modeler || typeof modeler.importXML !== "function") {
        throw new Error("Modeler inválido ou indisponível para criar diagrama.");
    }

    const xml = buildInitialXml(options);

    let result;
    try {
        result = await modeler.importXML(xml);
    } catch (err) {
        console.error("[BPMN Studio] falha ao criar diagrama inicial:", err);
        const wrapped = new Error(
            "Não foi possível criar o diagrama inicial. " +
            (err?.message || "")
        );
        wrapped.cause = err;
        throw wrapped;
    }

    if (options.fitViewport !== false) {
        try {
            const canvas = modeler.get("canvas");
            canvas.zoom("fit-viewport", "auto");
        } catch (err) {
            // silencioso — cosmético
        }
    }

    if (window.BPMNStudio?.state) {
        window.BPMNStudio.state.currentFileName = null;
        window.BPMNStudio.state.hasUnsavedChanges = false;
    }

    return {
        xml,
        warnings: result?.warnings || [],
    };
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

export async function run(modeler, options = {}) {
    if (options.confirm) {
        const hasUnsaved = window.BPMNStudio?.state?.hasUnsavedChanges;
        if (hasUnsaved) {
            const ok = window.confirm(
                "Você tem alterações não salvas. Criar um novo diagrama mesmo assim?"
            );
            if (!ok) {
                return null;
            }
        }
    }

    const result = await doCreate(modeler, options);

    const warningsCount = result.warnings?.length || 0;
    if (warningsCount > 0) {
        console.warn(
            `[BPMN Studio] novo diagrama criado com ${warningsCount} aviso(s).`,
            result.warnings
        );
    } else {
        console.info("[BPMN Studio] novo diagrama criado.");
    }

    return result;
}

export function previewXml(options = {}) {
    return buildInitialXml(options);
}

export async function withName(modeler, processName) {
    return run(modeler, { processName, fitViewport: true });
}