/* ============================================================
   BPMN Studio — js/io/exportBpmn.js
   Exporta o diagrama atual como BPMN 2.0 XML e dispara download.
   Formatos suportados: ".bpmn" e ".bpmn20.xml".
   ============================================================ */

// ------------------------------------------------------------
// Configuração de formatos suportados
// ------------------------------------------------------------
const FORMATS = {
    bpmn: {
        extension: ".bpmn",
        mime: "application/xml",
        label: "BPMN 2.0 (.bpmn)",
    },
    bpmn20: {
        extension: ".bpmn20.xml",
        mime: "application/xml",
        label: "BPMN 2.0 (.bpmn20.xml)",
    },
};

// ------------------------------------------------------------
// Helpers internos
// ------------------------------------------------------------

/**
 * Sanitiza um nome de arquivo removendo caracteres problemáticos
 * em Windows / macOS / Linux.
 */
function sanitizeFileName(name) {
    if (!name || typeof name !== "string") return "diagram";
    return (
        name
            .trim()
            .replace(/\.(bpmn|bpmn20\.xml|xml)$/i, "") // remove extensão duplicada
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_") // caracteres inválidos
            .replace(/\s+/g, "_")                        // espaços → underline
            .replace(/_+/g, "_")                         // underscores duplicados
            .replace(/^_+|_+$/g, "")                     // trim de _
            .slice(0, 100)                               // limite de tamanho
        || "diagram"
    );
}

/**
 * Detecta um nome base para o arquivo:
 *   1. nome do arquivo aberto (se houver)
 *   2. nome do processo no diagrama (se houver)
 *   3. fallback "diagram"
 */
function detectBaseName(modeler) {
    // 1) Nome do arquivo aberto (definido por importBpmn ou toolbar)
    const currentFileName = window.BPMNStudio?.state?.currentFileName;
    if (currentFileName) {
        return sanitizeFileName(currentFileName);
    }

    // 2) Nome do processo (primeiro participant ou process)
    try {
        const registry = modeler.get("elementRegistry");
        const root = registry.getAll().find((el) => {
            const t = el.businessObject?.$type;
            return t === "bpmn:Process" || t === "bpmn:Participant";
        });
        const name = root?.businessObject?.name;
        if (name && typeof name === "string") {
            return sanitizeFileName(name);
        }
    } catch (err) {
        // silencioso — fallback abaixo
    }

    // 3) Fallback
    return "diagram";
}

/**
 * Verifica se o XML gerado é plausível como BPMN 2.0.
 * Não substitui validação XSD real, mas pega os casos mais comuns.
 */
function assertValidBpmnXml(xml) {
    if (typeof xml !== "string" || xml.length === 0) {
        throw new Error("XML BPMN vazio.");
    }

    // Deve começar com declaração XML ou com a tag <definitions>
    const trimmed = xml.trim();
    if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<")) {
        throw new Error("XML BPMN inválido: conteúdo não é XML.");
    }

    // Deve conter o namespace BPMN 2.0
    if (!trimmed.includes("bpmn:definitions") && !trimmed.includes("<definitions")) {
        throw new Error("XML BPMN inválido: elemento <definitions> ausente.");
    }

    // Deve conter o namespace oficial do BPMN 2.0
    if (!trimmed.includes("http://www.omg.org/spec/BPMN/20100524/MODEL")) {
        throw new Error(
            "XML BPMN inválido: namespace BPMN 2.0 oficial ausente."
        );
    }

    return true;
}

/**
 * Dispara download de um Blob no navegador.
 * Usa <a download> + URL.createObjectURL — compatível com Chrome,
 * Firefox, Edge e Safari modernos.
 */
function triggerDownload(content, filename, mime) {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);

    try {
        a.click();
    } finally {
        // Cleanup: remove o <a> e revoga a URL do blob
        setTimeout(() => {
            if (a.parentNode) a.parentNode.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    }
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

/**
 * Exporta o diagrama atual e dispara download.
 *
 * @param {object} modeler - instância do bpmn-js
 * @param {"bpmn"|"bpmn20"} [format="bpmn"] - formato de saída
 * @returns {Promise<{filename: string, xml: string}>}
 * @throws {Error} se a exportação falhar
 */
export async function run(modeler, format = "bpmn") {
    if (!modeler || typeof modeler.saveXML !== "function") {
        throw new Error("Modeler inválido ou indisponível para exportação.");
    }

    const fmt = FORMATS[format] || FORMATS.bpmn;

    // 1) Gera o XML pelo bpmn-js
    let xml;
    try {
        const result = await modeler.saveXML({ format: true });
        xml = result?.xml;
    } catch (err) {
        console.error("[BPMN Studio] saveXML falhou:", err);
        throw new Error(
            "Não foi possível serializar o diagrama em XML. " +
            (err.message || "")
        );
    }

    // 2) Valida minimamente o XML gerado
    assertValidBpmnXml(xml);

    // 3) Monta o nome do arquivo
    const base = detectBaseName(modeler);
    const filename = `${base}${fmt.extension}`;

    // 4) Dispara o download
    triggerDownload(xml, filename, fmt.mime);

    // 5) Log informativo no console
    const sizeKb = (new Blob([xml]).size / 1024).toFixed(1);
    console.info(
        `[BPMN Studio] exportado "${filename}" (${sizeKb} KB) — ${fmt.label}`
    );

    return { filename, xml };
}

/**
 * Exporta apenas o XML como string, sem disparar download.
 * Útil para debug e testes (usado por window.BPMNStudio.exportXml).
 */
export async function toXml(modeler) {
    if (!modeler || typeof modeler.saveXML !== "function") {
        throw new Error("Modeler inválido ou indisponível para exportação.");
    }
    const result = await modeler.saveXML({ format: true });
    const xml = result?.xml;
    assertValidBpmnXml(xml);
    return xml;
}

/**
 * Lista de formatos suportados (para UI futura, ex.: dropdown).
 */
export function supportedFormats() {
    return Object.entries(FORMATS).map(([key, cfg]) => ({
        key,
        label: cfg.label,
        extension: cfg.extension,
    }));
}