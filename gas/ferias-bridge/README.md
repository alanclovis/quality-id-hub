# Férias Bridge (planilha dedicada)

Fonte de dados da **página Férias** do Quality ID Hub. O resto do hub continua no Gist.

## 1. Criar a planilha

1. [Google Sheets](https://sheets.google.com) → nova planilha **Quality Hub — Férias**.
2. Copie o ID da URL: `https://docs.google.com/spreadsheets/d/ESTE_ID/edit`

## 2. Criar o projeto GAS

1. [script.google.com](https://script.google.com) → **Novo projeto** (standalone, sem planilha vinculada).
2. Cole `FeriasBridge.gs` e `appsscript.json`.
3. Em `FeriasBridge.gs`, defina o ID **no código** ou em **Propriedades do script**:

| Onde | Chave | Valor |
|------|-------|-------|
| Propriedades do script (recomendado) | `FERIAS_SHEET_ID` | ID da planilha |
| Ou linha 10 do `.gs` | `var FERIAS_SHEET_ID = '...'` | ID da planilha |

4. No editor, execute **`setupFeriasSheet`** uma vez — cria a aba `Férias` com cabeçalhos:

| id | nome | email | inicio | fim | tipo | status | updated_at | updated_by |

## 3. Publicar Web App

**Implantar → Nova implantação → App da web**

- Executar como: **Eu**
- Quem tem acesso: conforme política Nubank

Copie a URL `/exec`.

## 4. Configurar no Hub (só admin, uma vez)

**Configuração → Técnico → URL Férias** → cole a URL → **Salvar** (publica no pack para todo o time).

## Endpoints (JSON / JSONP)

| `ferias` | Função |
|----------|--------|
| `ping` | Saúde |
| `getFerias` | Lista todos os registros |
| `saveFerias` | Insert (sem `id`) ou update (com `id`) |
| `deleteFerias` | Remove por `id` (dono ou admin) |
| `migrateFerias` | Import one-shot (admin) |

JSONP (Hub):

`.../exec?ferias=getFerias&payload={}&callback=feriasCb_1`

Payload de save:

```json
{
  "record": { "id": "F-abc", "inicio": "2026-07-01", "fim": "2026-07-15", "tipo": "ferias", "status": "verde" },
  "memberName": "Alan Clovis",
  "userEmail": "alan.clovis@nubank.com.br",
  "isAdmin": false
}
```

## Migração do Gist (opcional)

No hub, admin com dados legados em `data.ferias` pode chamar `migrateFerias` via console ou botão de migração com `records` do Gist.

## clasp (opcional)

```bash
cd gas/ferias-bridge
clasp create --type standalone --title "Quality Ferias Bridge"
clasp push
```
