/* ============================================================
   BPMN Studio — js/exportBpmn.js
   Exporta o diagrama como BPMN 2.0 XML (.bpmn / .bpmn20.xml).
   ============================================================ */

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
// Helpers
// ------------------------------------------------------------

function sanitizeFileName(name) {
    if (!name || typeof name !== "string") return "diagram";
    return (
        name
            .trim()
            .replace(/\.(bpmn|bpmn20\.xml|xml)$/i, "")
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
            .replace(/\s+/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 100)
        || "diagram"
    );
}

function detectBaseName(modeler) {
    const current = window.BPMNStudio?.state?.currentFileName;
    if (current) return sanitizeFileName(current);

    try {
        const registry = modeler.get("elementRegistry");
        const root = registry.getAll().find((el) => {
            const t = el.businessObject?.$type;
            return t === "bpmn:Process" || t === "bpmn:Participant";
        });

        const name = root?.businessObject?.name;
        if (name) return sanitizeFileName(name);
    } catch {
        // fallback
    }

    return "diagram";
}

function assertValidBpmnXml(xml) {
    if (typeof xml !== "string" || xml.length === 0) {
        throw new Error("XML BPMN vazio.");
    }

    const trimmed = xml.trim();

    if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<")) {
        throw new Error("Conteúdo não é XML.");
    }

    if (
        !trimmed.includes("bpmn:definitions") &&
        !trimmed.includes("<definitions")
    ) {
        throw new Error("Elemento <definitions> ausente.");
    }

    if (!trimmed.includes("http://www.omg.org/spec/BPMN/20100524/MODEL")) {
        throw new Error("Namespace BPMN 2.0 ausente.");
    }

    return true;
}

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
        setTimeout(() => {
            if (a.parentNode) a.parentNode.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    }
}

// ------------------------------------------------------------
// API
// ------------------------------------------------------------

export async function run(modeler, format = "bpmn") {
    if (!modeler || typeof modeler.saveXML !== "function") {
        throw new Error("Modeler inválido para exportação.");
    }

    const fmt = FORMATS[format] || FORMATS.bpmn;

    let xml;
    try {
        const result = await modeler.saveXML({ format: true });
        xml = result?.xml;
    } catch (err) {
        console.error("[BPMN Studio] saveXML falhou:", err);
        throw new Error("Não foi possível serializar o diagrama.");
    }

    assertValidBpmnXml(xml);

    const base = detectBaseName(modeler);
    const filename = `${base}${fmt.extension}`;

    triggerDownload(xml, filename, fmt.mime);

    const sizeKb = (new Blob([xml]).size / 1024).toFixed(1);
    console.info(
        `[BPMN Studio] exportado "${filename}" (${sizeKb} KB)`
    );

    return { filename, xml };
}

export async function toXml(modeler) {
    if (!modeler || typeof modeler.saveXML !== "function") {
        throw new Error("Modeler inválido.");
    }

    const result = await modeler.saveXML({ format: true });
    const xml = result?.xml;

    assertValidBpmnXml(xml);
    return xml;
}

export function supportedFormats() {
    return Object.entries(FORMATS).map(([key, cfg]) => ({
        key,
        label: cfg.label,
        extension: cfg.extension,
    }));
}