# Instalar ponte Hub no GAS **Dim Quality ID** (já publicado)

Você **já tem** o app completo. Só adiciona 2 arquivos + 5 linhas no `doGet`.

Eu **não consigo editar** o Apps Script na sua conta Google daqui. Você faz em **2 minutos** copiando do repo, ou usa `clasp push` se tiver clasp logado.

---

## Passo 1 — Criar `Bridge.html`

1. Apps Script → **+** → **HTML** → nome: `Bridge`
2. Cole o conteúdo de [`Bridge.html`](Bridge.html) deste repo
3. Salvar

---

## Passo 2 — Criar `HubBridge.gs`

1. **+** → **Script** → nome: `HubBridge`
2. Cole o conteúdo de [`HubBridge.gs`](HubBridge.gs)
3. Salvar

---

## Passo 3 — Ajustar `doGet` no **Código.gs** (seu arquivo)

**Substitua** a função `doGet` inteira (não cole no final do arquivo). Troque isto:

```javascript
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
```

Por isto:

```javascript
function doGet(e) {
  // Ponte Quality ID Hub
  if (e && e.parameter && e.parameter.view === 'bridge') {
    return HtmlService.createHtmlOutputFromFile('Bridge')
      .setTitle('Dim Bridge')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createTemplateFromFile('Index')
```

O resto do `doGet` (`.evaluate()`, `.setTitle(...)`, etc.) **permanece igual**.

---

## Passo 4 — Reimplantar

1. **Implantar** → **Gerenciar implantações**
2. **Editar** (ícone lápis) → **Nova versão** → **Implantar**

---

## Passo 5 — Hub

1. Copie a URL `/exec` que você **já usa**
2. Hub → **Configuração → Técnico → URL ponte Dimensionamento**
3. Cole e **Salvar**

---

## Testar

| URL | Esperado |
|---|---|
| `.../exec` | App antigo (Index) — igual hoje |
| `.../exec?view=bridge` | Texto "Ponte ativa" |
| Hub → Dimensionamento | Conectado + grade |

---

## Opcional — clasp (editar pelo Cursor e enviar)

```bash
npm i -g @google/clasp
clasp login
cd quality-id-hub/gas
# .clasp.json com scriptId do Dim Quality ID
clasp push
```

Só envia arquivos locais; **reimplantar** continua manual no console Google.

---

## Não copie estes arquivos do repo para cima do seu projeto

- `Codigo.gs` (local) — você já tem o oficial
- `Config_Slots.gs` — você usa `Config_Slots.html`
- `ApiRouter.gs` — use `HubBridge.gs` (sem doGet duplicado)
