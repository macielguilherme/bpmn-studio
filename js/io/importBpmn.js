/* ============================================================
   BPMN Studio — js/io/importBpmn.js
   Importa um arquivo BPMN (.bpmn / .bpmn20.xml / .xml) e o carrega
   no modeler. Validação mínima antes de entregar ao bpmn-js.
   ============================================================ */

// ------------------------------------------------------------
// Constantes de limite
// ------------------------------------------------------------
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_EXTENSIONS = [".bpmn", ".bpmn20.xml", ".xml"];

// ------------------------------------------------------------
// Helpers internos
// ------------------------------------------------------------

/**
 * Verifica se a extensão do arquivo é aceita.
 * Aceita ".bpmn", ".bpmn20.xml" e ".xml".
 */
function hasAcceptedExtension(fileName) {
    if (!fileName || typeof fileName !== "string") return false;
    const lower = fileName.toLowerCase();
    return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Lê um File como texto UTF-8, com fallback para Latin-1 se
 * detectar bytes inválidos (arquivos antigos gerados em Windows).
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
            reject(new Error("Não foi possível ler o arquivo."));

        // Sempre tenta UTF-8 primeiro (padrão do BPMN 2.0)
        reader.readAsText(file, "UTF-8");
    });
}

/**
 * Detecta se o texto parece ser XML minimamente válido
 * (não substitui parser real, mas pega arquivos vazios
 * ou claramente não-XML antes de chamar o bpmn-js).
 */
function looksLikeXml(text) {
    if (typeof text !== "string") return false;
    const trimmed = text.trim();
    if (trimmed.length === 0) return false;

    // Deve começar com declaração XML ou com uma tag
    if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<")) {
        return false;
    }

    // Deve conter <definitions> (raiz do BPMN 2.0) — com ou sem prefixo
    if (!trimmed.includes("bpmn:definitions") && !trimmed.includes("<definitions")) {
        return false;
    }

    return true;
}

/**
 * Detecta se o XML é BPMN 2.0 oficial pelo namespace.
 */
function hasBpmnNamespace(text) {
    return (
        typeof text === "string" &&
        text.includes("http://www.omg.org/spec/BPMN/20100524/MODEL")
    );
}

/**
 * Traduz warnings/erros do bpmn-js para mensagens amigáveis.
 * A lib retorna { warnings: [...] } em sucesso parcial e lança
 * exceção em erro fatal.
 */
function describeImportResult(result) {
    if (!result || !Array.isArray(result.warnings)) return null;
    if (result.warnings.length === 0) return null;

    const first = result.warnings[0];
    const count = result.warnings.length;
    const suffix = count > 1 ? ` (e mais ${count - 1} aviso(s))` : "";
    return `${first.message || "Aviso ao importar"}${suffix}`;
}

// ------------------------------------------------------------
// Núcleo da importação (usado tanto por run() quanto por fromString())
// ------------------------------------------------------------

async function doImport(modeler, xml, options = {}) {
    if (!modeler || typeof modeler.importXML !== "function") {
        throw new Error("Modeler inválido ou indisponível para importação.");
    }

    if (!looksLikeXml(xml)) {
        throw new Error(
            "O conteúdo não parece ser um arquivo BPMN 2.0 válido. " +
            "Verifique se o arquivo não está vazio ou corrompido."
        );
    }

    if (!hasBpmnNamespace(xml)) {
        throw new Error(
            "O XML não contém o namespace BPMN 2.0 oficial. " +
            "Talvez seja um BPMN 1.x ou outro tipo de diagrama."
        );
    }

    let result;
    try {
        result = await modeler.importXML(xml);
    } catch (err) {
        // Erro fatal do bpmn-js — normalmente XML malformado ou schema inválido
        const msg =
            err?.message?.replace(/^failed to import /i, "") ||
            "XML BPMN inválido.";
        const wrapped = new Error(`Falha ao importar BPMN: ${msg}`);
        wrapped.cause = err;
        throw wrapped;
    }

    // Após importar, ajusta o viewport para mostrar o diagrama inteiro
    if (options.fitViewport !== false) {
        try {
            const canvas = modeler.get("canvas");
            canvas.zoom("fit-viewport", "auto");
        } catch (err) {
            // silencioso — fit é cosmético, não deve falhar a importação
        }
    }

    // Extrai nome do processo (para statusbar / título futuro)
    let processName = null;
    try {
        const registry = modeler.get("elementRegistry");
        const root = registry.getAll().find((el) => {
            const t = el.businessObject?.$type;
            return t === "bpmn:Process" || t === "bpmn:Participant";
        });
        processName = root?.businessObject?.name || null;
    } catch (err) {
        // silencioso
    }

    const warning = describeImportResult(result);

    return { processName, warning, xml };
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

/**
 * Importa um File selecionado pelo usuário.
 *
 * @param {object} modeler - instância do bpmn-js
 * @param {File} file - arquivo vindo do <input type="file">
 * @returns {Promise<{filename: string, processName: string|null, warning: string|null, xml: string}>}
 * @throws {Error} em qualquer falha (leitura, validação, parse)
 */
export async function run(modeler, file) {
    // 1) Valida argumento
    if (!file) {
        throw new Error("Nenhum arquivo foi selecionado.");
    }

    // 2) Valida tipo (extensão)
    if (!hasAcceptedExtension(file.name)) {
        throw new Error(
            `Extensão não suportada: "${file.name}". ` +
            `Use .bpmn, .bpmn20.xml ou .xml.`
        );
    }

    // 3) Valida tamanho
    if (file.size > MAX_FILE_SIZE) {
        const mb = (file.size / 1024 / 1024).toFixed(1);
        throw new Error(
            `Arquivo muito grande (${mb} MB). ` +
            `O limite é ${MAX_FILE_SIZE / 1024 / 1024} MB.`
        );
    }

    if (file.size === 0) {
        throw new Error("O arquivo está vazio.");
    }

    // 4) Lê o conteúdo
    const xml = await readFileAsText(file);

    // 5) Importa no modeler
    const result = await doImport(modeler, xml);

    // 6) Atualiza estado global (nome do arquivo aberto)
    if (window.BPMNStudio?.state) {
        window.BPMNStudio.state.currentFileName = file.name;
    }

    const sizeKb = (file.size / 1024).toFixed(1);
    console.info(
        `[BPMN Studio] importado "${file.name}" (${sizeKb} KB)` +
        (result.processName ? ` — processo: "${result.processName}"` : "")
    );

    return {
        filename: file.name,
        processName: result.processName,
        warning: result.warning,
        xml,
    };
}

/**
 * Importa XML já em memória como string.
 * Útil para debug (window.BPMNStudio.importXml) e para testes.
 *
 * @param {object} modeler
 * @param {string} xml
 * @returns {Promise<{processName: string|null, warning: string|null, xml: string}>}
 */
export async function fromString(modeler, xml) {
    if (typeof xml !== "string" || xml.trim().length === 0) {
        throw new Error("XML vazio ou inválido.");
    }

    const result = await doImport(modeler, xml);

    // Ao importar por string, não há arquivo "aberto" — limpa o nome
    if (window.BPMNStudio?.state) {
        window.BPMNStudio.state.currentFileName = null;
    }

    return {
        processName: result.processName,
        warning: result.warning,
        xml: result.xml,
    };
}

/**
 * Retorna os formatos/extensões aceitos (para UI e para o <input accept>).
 */
export function acceptedExtensions() {
    return [...ACCEPTED_EXTENSIONS];
}