/* ============================================================
   BPMN Studio — js/importBpmn.js
   Importa um arquivo BPMN (.bpmn / .bpmn20.xml / .xml).
   ============================================================ */

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".bpmn", ".bpmn20.xml", ".xml"];

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function hasAcceptedExtension(fileName) {
    if (!fileName) return false;
    const lower = fileName.toLowerCase();
    return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));

        reader.readAsText(file, "UTF-8");
    });
}

function looksLikeXml(text) {
    if (typeof text !== "string") return false;

    const trimmed = text.trim();
    if (trimmed.length === 0) return false;
    if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<")) return false;

    if (
        !trimmed.includes("bpmn:definitions") &&
        !trimmed.includes("<definitions")
    ) {
        return false;
    }

    return true;
}

function hasBpmnNamespace(text) {
    return (
        typeof text === "string" &&
        text.includes("http://www.omg.org/spec/BPMN/20100524/MODEL")
    );
}

function describeImportResult(result) {
    if (!result || !Array.isArray(result.warnings)) return null;
    if (result.warnings.length === 0) return null;

    const first = result.warnings[0];
    const count = result.warnings.length;
    const suffix = count > 1 ? ` (e mais ${count - 1})` : "";

    return `${first.message || "Aviso ao importar"}${suffix}`;
}

async function doImport(modeler, xml, options = {}) {
    if (!modeler || typeof modeler.importXML !== "function") {
        throw new Error("Modeler inválido para importação.");
    }

    if (!looksLikeXml(xml)) {
        throw new Error(
            "O conteúdo não parece ser um BPMN 2.0 válido."
        );
    }

    if (!hasBpmnNamespace(xml)) {
        throw new Error(
            "O XML não contém o namespace BPMN 2.0 oficial."
        );
    }

    let result;
    try {
        result = await modeler.importXML(xml);
    } catch (err) {
        const msg = err?.message?.replace(/^failed to import /i, "") ||
            "XML BPMN inválido.";

        const wrapped = new Error(`Falha ao importar: ${msg}`);
        wrapped.cause = err;
        throw wrapped;
    }

    

    let processName = null;
    try {
        const registry = modeler.get("elementRegistry");
        const root = registry.getAll().find((el) => {
            const t = el.businessObject?.$type;
            return t === "bpmn:Process" || t === "bpmn:Participant";
        });
        processName = root?.businessObject?.name || null;
    } catch {
        // silencioso
    }

    return { processName, warning: describeImportResult(result), xml };
}

// ------------------------------------------------------------
// API
// ------------------------------------------------------------

export async function run(modeler, file) {
    if (!file) throw new Error("Nenhum arquivo selecionado.");

    if (!hasAcceptedExtension(file.name)) {
        throw new Error(
            `Extensão não suportada: "${file.name}". Use .bpmn, .bpmn20.xml ou .xml.`
        );
    }

    if (file.size > MAX_FILE_SIZE) {
        const mb = (file.size / 1024 / 1024).toFixed(1);
        throw new Error(
            `Arquivo muito grande (${mb} MB). Limite: ${MAX_FILE_SIZE / 1024 / 1024} MB.`
        );
    }

    if (file.size === 0) {
        throw new Error("O arquivo está vazio.");
    }

    const xml = await readFileAsText(file);
    const result = await doImport(modeler, xml);

    if (window.BPMNStudio?.state) {
        window.BPMNStudio.state.currentFileName = file.name;
    }

    const sizeKb = (file.size / 1024).toFixed(1);
    console.info(
        `[BPMN Studio] importado "${file.name}" (${sizeKb} KB)` +
        (result.processName ? ` — "${result.processName}"` : "")
    );

    return {
        filename: file.name,
        processName: result.processName,
        warning: result.warning,
        xml,
    };
}

export async function fromString(modeler, xml) {
    if (typeof xml !== "string" || xml.trim().length === 0) {
        throw new Error("XML vazio ou inválido.");
    }

    const result = await doImport(modeler, xml);

    if (window.BPMNStudio?.state) {
        window.BPMNStudio.state.currentFileName = null;
    }

    return result;
}

export function acceptedExtensions() {
    return [...ACCEPTED_EXTENSIONS];
}