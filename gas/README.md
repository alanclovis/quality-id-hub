# Apps Script — Dimensionamento ID Quality/Csat

## Já tem o projeto **Dim Quality ID** publicado?

Use **[INSTALAR-NO-GAS-EXISTENTE.md](INSTALAR-NO-GAS-EXISTENTE.md)** — só `Bridge.html` + `HubBridge.gs` + 5 linhas no `doGet`.

A pasta `gas/` aqui no GitHub é referência + ponte Hub; **não substitua** seu `Código.gs` / `App_Logica.html` de produção.

## Deploy projeto novo (do zero)

1. Instale [clasp](https://github.com/google/clasp): `npm i -g @google/clasp`
2. Copie `.clasp.json.example` → `.clasp.json` e preencha o `scriptId`
3. `clasp push`
4. Na planilha: **Publicar → Implantar como aplicativo da web**
   - Executar como: **Quem acessa**
   - Acesso: **Somente usuários do domínio** (nubank.com.br)
5. Copie a URL `/exec` para o Hub (Configuração → Dimensionamento → URL da ponte)

## Arquivos

| Arquivo | Função |
|---|---|
| `Codigo.gs` | Leitura/escrita H1/H2 + Base_Detalhes |
| `ApiRouter.gs` | Roteador de ações para o Hub |
| `Bridge.html` | Iframe postMessage ↔ Hub |
| `Config_Slots.gs` | Constantes de slots e analistas |
| `Estilos_Cores.gs` | Cores por categoria |
| `Deep Dive.js` | Painel Deep Dive (menu, modal, abas IC4) |
| `DeepDive Slots.js` | Legado — substituído por `Deep Dive.js` |
| `Preenchimento automatico.gs` | Dimensionamento automático |
| `GerarLinhas.gs` | Novos analistas (aba Auxiliar) |
| `Index.html` | Web App standalone (legado) |

## URL da ponte no Hub

```
https://script.google.com/macros/s/SEU_DEPLOY_ID/exec?view=bridge
```
