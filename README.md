# BPMN Studio

> Modelador visual de processos **BPMN 2.0** que roda 100% no navegador.
> Sem backend, sem instalação, sem cadastro. Abre, modela, exporta.

[![Demo](https://img.shields.io/badge/demo-online-3b5bdb?style=flat-square)](https://macielguilherme.github.io/bpmn-studio/)
[![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-16a34a?style=flat-square)](LICENSE)
[![Feito com](https://img.shields.io/badge/feito%20com-HTML%20%2B%20CSS%20%2B%20JS-475569?style=flat-square)](#tecnologias)

---

## 📌 Sobre

**BPMN Studio** é uma aplicação web estática para criação e edição de diagramas de processo no padrão **BPMN 2.0**. O objetivo é oferecer uma alternativa leve e sem dependências a ferramentas desktop como Camunda Modeler e Bizagi — acessível por qualquer navegador moderno, sem instalação.

Tudo acontece no cliente: a modelagem, a serialização para XML BPMN 2.0 e o download do arquivo. Nenhum dado sai do navegador do usuário.

**🔗 Demo:** https://macielguilherme.github.io/bpmn-studio/

---

## ✨ Funcionalidades

### Modelagem
- ✅ Evento inicial
- ✅ Evento intermediário
- ✅ Evento final
- ✅ Tarefa (genérica, de usuário, de serviço)
- ✅ Subprocesso
- ✅ Gateway exclusivo
- ✅ Gateway paralelo
- ✅ Gateway inclusivo
- ✅ Sequence Flow (fluxo de sequência)
- ✅ Message Flow (fluxo de mensagem)
- ✅ Pool (Participant)
- ✅ Lane
- ✅ Data Object

### Editor
- ✅ Arrastar elementos da paleta para o canvas
- ✅ Criar elementos por clique (com offset em cascata)
- ✅ Mover e reposicionar elementos
- ✅ Conectar elementos via handles
- ✅ Editar nomes inline (duplo clique)
- ✅ Excluir elementos (`Delete`)
- ✅ Zoom (`Ctrl` + `+` / `-` / `0`, botões na statusbar)
- ✅ Centralizar diagrama (`fit-viewport`)
- ✅ Desfazer / Refazer (`Ctrl+Z` / `Ctrl+Y`)
- ✅ Painel de propriedades (nome, tipo, ID)

### Arquivos
- ✅ Novo diagrama (com Start Event inicial)
- ✅ Importar arquivo `.bpmn` / `.bpmn20.xml` / `.xml`
- ✅ Exportar `.bpmn`
- ✅ Exportar `.bpmn20.xml`

### Interface
- ✅ Toolbar superior com ações de arquivo
- ✅ Paleta lateral de elementos BPMN organizada por categoria
- ✅ Área central de modelagem com grade visual
- ✅ Painel de propriedades contextuais
- ✅ Barra de status com zoom e indicador de compatibilidade BPMN 2.0
- ✅ Notificações (toasts) para sucesso / aviso / erro
- ✅ Atalhos de teclado (`Ctrl+N`, `Ctrl+O`, `Ctrl+S`, `Ctrl+Z`, `Delete`, ...)

---

## 🛠 Tecnologias

| Camada | Tecnologia | Por quê |
|---|---|---|
| **Estrutura** | HTML5 | Sem build step, sem framework |
| **Estilo** | CSS3 (Grid + Flexbox + Custom Properties) | Temas futuros, consistência de tokens |
| **Lógica** | JavaScript (ES Modules) | Nativo, sem bundler |
| **Modelagem** | [`bpmn-js`](https://github.com/bpmn-io/bpmn-js) 17.x | Biblioteca de referência do time bpmn.io |
| **Hospedagem** | GitHub Pages | Estático, gratuito, HTTPS |

**Sem dependências de runtime** além do `bpmn-js`. Sem npm, sem Webpack, sem Vite. O projeto é servido como HTML/CSS/JS puro.

---

## 🖼 Screenshots

> Substitua as imagens abaixo por prints reais depois de rodar o projeto.
> Salve em `docs/screenshots/` com os nomes indicados.

### Tela principal

![Tela principal do BPMN Studio](docs/screenshots/main.png)

### Modelando um processo

![Diagrama BPMN sendo editado](docs/screenshots/editing.png)

### Exportação

![Arquivo .bpmn gerado](docs/screenshots/export.png)

---

## 🚀 Como executar localmente

Não há build. Não há instalação de dependências.

### Opção 1 — Servir com Python (recomendado)

```bash
# Clone
git clone https://github.com/macielguilherme/bpmn-studio.git
cd bpmn-studio

# Sirva (Python 3)
python -m http.server 8000

# Abra http://localhost:8000
```

### Opção 2 — Servir com Node

```bash
npx serve .
# ou
npx http-server -p 8000
```

### Opção 3 — Abrir direto no navegador

Alguns navegadores bloqueiam `type="module"` quando o arquivo é aberto via `file://`.
Se for usar essa opção, prefira as anteriores. Como fallback, teste no Firefox,
que é mais tolerante.

```text
Clique duplo em index.html
```

**Requisitos:** navegador moderno (Chrome, Firefox, Edge, Safari) com suporte a ES Modules e `fetch`.

---

## 🎯 Como utilizar

### Criando seu primeiro processo

1. Abra a aplicação.
2. Você verá um **Start Event** já posicionado no canvas.
3. Na paleta lateral esquerda, **arraste** o elemento desejado para o canvas
   (ou apenas clique nele para inseri-lo no centro).
4. Para **conectar** dois elementos, passe o mouse sobre o primeiro — aparecerão
   pequenas setas nas bordas. Clique em uma seta e arraste até o elemento de destino.
5. Para **renomear**, dê duplo clique sobre o elemento (ou edite o nome no painel
   de propriedades à direita).
6. Para **mover**, arraste o elemento pelo corpo.
7. Para **excluir**, selecione e pressione `Delete`.

### Atalhos de teclado

| Atalho | Ação |
|---|---|
| `Ctrl + N` | Novo diagrama |
| `Ctrl + O` | Abrir arquivo BPMN |
| `Ctrl + S` | Exportar (salvar) como `.bpmn` |
| `Ctrl + Z` | Desfazer |
| `Ctrl + Y` (ou `Ctrl + Shift + Z`) | Refazer |
| `Ctrl + +` | Aumentar zoom |
| `Ctrl + -` | Diminuir zoom |
| `Ctrl + 0` | Centralizar diagrama |
| `Delete` | Excluir elemento selecionado |
| `Esc` | Cancelar edição de nome |

### Exportando BPMN

O arquivo gerado é **BPMN 2.0 XML válido** e pode ser aberto em qualquer
ferramenta compatível:

- [Camunda Modeler](https://camunda.com/download/modeler/) (desktop)
- [bpmn.io](https://demo.bpmn.io) (online)
- [Bizagi Modeler](https://www.bizagi.com/) (desktop)
- [Signavio](https://www.signavio.com/) (SaaS)

**Fluxo:**
1. Clique em **Exportar BPMN** na toolbar (ou `Ctrl+S`).
2. O navegador baixa o arquivo — o nome é baseado no nome do processo.
3. O arquivo contém o **layout visual (BPMNDI)** além da estrutura do processo,
   então abre em qualquer ferramenta já posicionado corretamente.

---

## 📁 Estrutura do projeto

```text
bpmn-studio/
├── index.html              # Shell da aplicação
├── LICENSE                 # MIT
├── README.md               # Este arquivo
├── .nojekyll               # Desabilita Jekyll no GitHub Pages
├── css/
│   ├── reset.css           # Normalização cross-browser
│   ├── variables.css       # Design tokens (cores, espaços, tipografia)
│   ├── layout.css          # Grid e posicionamento macro
│   ├── components.css      # Componentes reutilizáveis (botões, badges, toasts)
│   └── style.css           # Refinamentos e overrides do bpmn-js
├── js/
│   ├── main.js             # Bootstrap e orquestração
│   ├── editor/
│   │   ├── modeler.js      # Instancia o bpmn-js
│   │   ├── palette.js      # Sidebar → canvas (drag-and-drop)
│   │   └── properties.js   # Painel de propriedades
│   ├── io/
│   │   ├── newDiagram.js   # Cria diagrama inicial
│   │   ├── exportBpmn.js   # Serializa e baixa .bpmn / .bpmn20.xml
│   │   └── importBpmn.js   # Lê e valida arquivo BPMN
│   ├── ui/
│   │   ├── toolbar.js      # Ações da toolbar e atalhos
│   │   ├── statusbar.js    # Zoom, badge e mensagens
│   │   └── notifications.js # Sistema de toasts
│   └── validation/
│       └── validator.js    # Validação estrutural (regras básicas)
├── assets/
│   ├── icons/
│   │   └── favicon.svg
│   └── img/
└── docs/
    └── screenshots/
```

---

## ⚠️ Limitações conhecidas (V1)

Esta é a primeira versão. Algumas coisas são intencionalmente simples:

- **Sem backend.** Não há "salvar na nuvem" — tudo é local, download manual.
- **Validação básica.** O painel de validação cobre 5 regras estruturais
  (evento inicial, evento final, fluxos conectados, elementos isolados,
  gateways suspeitos). Não é validação XSD.
- **Sem multi-diagrama.** Só é possível trabalhar com um processo por vez.
- **Sem colaboração em tempo real.**
- **Exportação de imagem (PNG/SVG)** não está exposta na UI ainda
  (a função existe internamente, mas não tem botão).
- **Sem tema escuro.** A infraestrutura em `variables.css` já está preparada,
  mas não há toggle na UI.

---

## 🗺 Roadmap

### V2 — em consideração

- [ ] Painel de propriedades avançado (condição de fluxo, tipo de tarefa, atributos de evento)
- [ ] Exportação como PNG / SVG via UI
- [ ] Tema escuro com toggle
- [ ] Validação com `bpmn-moddle` (schema XSD real)
- [ ] Undo/Redo visual com histórico navegável
- [ ] Suporte a diagramas de colaboração (múltiplas pools)
- [ ] Atalhos adicionais (`Ctrl+C` / `Ctrl+V` para copiar elementos)

### V3 — ideias futuras

- [ ] Colaboração em tempo real (WebRTC ou WebSocket)
- [ ] Importar/exportar DMN
- [ ] Templates de processo pré-definidos
- [ ] Integração com GitHub Gist para salvar/compartilhar

> Itens acima **não estão implementados**. São planejamento, não promessa.

---

## 🧪 Testando

Não há suíte de testes automatizados na V1.

Testes manuais podem ser feitos pelo console do navegador — a aplicação
expõe uma API de debug em `window.BPMNStudio`:

```js
// Exporta o XML atual
await BPMNStudio.exportXml();

// Importa XML de string
await BPMNStudio.importXml("<bpmn:definitions ...>...</bpmn:definitions>");

// Consulta estado interno
BPMNStudio.state;
```

---

## 📄 Licença

Distribuído sob a **MIT License**. Veja [LICENSE](LICENSE) para o texto completo.

Você pode usar, modificar, distribuir e sublicenciar livremente,
inclusive para fins comerciais. A única exigência é manter o aviso de copyright.

---

## 👤 Autor

**Guilherme Maciel**

- GitHub: [@macielguilherme](https://github.com/macielguilherme)
- LinkedIn: [in/macielguilherme](https://www.linkedin.com/in/macielguilherme/)

---

## 🙏 Créditos

Este projeto não existiria sem:

- **[bpmn-js](https://github.com/bpmn-io/bpmn-js)** — biblioteca de modelagem BPMN 2.0 do time [bpmn.io](https://bpmn.io).
- **[diagram-js](https://github.com/bpmn-io/diagram-js)** — o motor de diagramas por trás do bpmn-js.
- **[BPMN 2.0 Specification](https://www.omg.org/spec/BPMN/2.0/)** — OMG.

---

<p align="center">
  Feito com cuidado para portfólio profissional.
</p>