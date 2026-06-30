# Planilha Hub Bridge (Férias + Membros)

Fonte de dados da **página Férias** e do **roster de membros** (login, papéis, perfis) do Quality ID Hub. Links, prioridades e aviso continuam no Gist.

## 1. Criar a planilha

1. [Google Sheets](https://sheets.google.com) → planilha **Quality Hub** (ou reutilize a existente).
2. Copie o ID da URL: `https://docs.google.com/spreadsheets/d/ESTE_ID/edit`

## 2. Criar o projeto GAS

1. [script.google.com](https://script.google.com) → **Novo projeto** (standalone, sem planilha vinculada).
2. Cole `FeriasBridge.gs` e `appsscript.json`.
3. Em `FeriasBridge.gs`, defina o ID **no código** ou em **Propriedades do script**:

| Onde | Chave | Valor |
|------|-------|-------|
| Propriedades do script (recomendado) | `FERIAS_SHEET_ID` | ID da planilha |
| Ou linha 10 do `.gs` | `var FERIAS_SHEET_ID = '...'` | ID da planilha |

4. No editor, execute **uma vez**:
   - `setupFeriasSheet` — cria a aba `Férias`
   - `setupMembersSheet` — cria a aba `Membros`
   - Ou `setupHubSheets` — cria as duas abas

### Aba `Férias`

| id | nome | email | inicio | fim | tipo | status | updated_at | updated_by |

### Aba `Membros`

| id | nome | email | role | status | invite_code | level | areas | joined_at | approved_at | approved_by | updated_at | updated_by |

- `role`: `member` / `editor` / `admin` / `visitor`
- `status`: `active` / `revoked` / `pending`
- `areas`: lista separada por vírgula (`id,csat`)
- Foto do perfil (base64) **não** vai para a planilha — fica em `localStorage` no navegador

## 3. Publicar Web App

**Implantar → Nova implantação → App da web**

- Executar como: **Eu**
- Quem tem acesso: conforme política Nubank

Copie a URL `/exec`.

## 4. Configurar no Hub (só admin, uma vez)

**Configuração → Técnico → URL Planilha Hub** → cole a URL → **Salvar** (publica no pack para todo o time).

## Endpoints (JSON / JSONP)

Parâmetro JSONP: `ferias=<ação>&payload=<json>&callback=<fn>`

| `ferias` | Função |
|----------|--------|
| `ping` | Saúde |
| `getFerias` | Lista registros de férias |
| `saveFerias` | Insert/update férias |
| `deleteFerias` | Remove férias por `id` |
| `migrateFerias` | Import one-shot férias do Gist (admin) |
| `getMembers` | Lista `accessUsers` + `profiles` da aba Membros |
| `saveMemberProfile` | Membro atualiza e-mail, nível e áreas (não altera `role`/`invite_code`) |
| `patchMembers` | Admin substitui roster inteiro |
| `migrateMembers` | Import one-shot membros do Gist (admin) |

JSONP (Hub):

`.../exec?ferias=getMembers&payload={}&callback=feriasCb_1`

Payload de perfil (membro):

```json
{
  "inviteCode": "AC-7X2K",
  "name": "Alan Clovis",
  "memberName": "Alan Clovis",
  "profile": { "level": "Analyst II", "areas": ["id", "csat"], "email": "alan.clovis@nubank.com.br" },
  "userEmail": "alan.clovis@nubank.com.br",
  "isAdmin": false
}
```

## Migração do Gist (opcional)

1. Configure a URL Planilha Hub no Hub.
2. Admin: **Importar férias do Gist para planilha** (se ainda houver `data.ferias` no pack).
3. Admin: **Importar membros do Gist para planilha** — copia `accessUsers` + `profiles` para a aba Membros.
4. Valide códigos e papéis na planilha; teste login e edição de perfil.
5. Após validação, o Hub deixa de gravar `profiles` / `accessUsers` no Gist automaticamente.

## Quem edita o quê (acesso à planilha)

**O time não precisa de acesso à planilha Google.** O Web App roda como quem fez o deploy (*Executar como: Eu*) e grava na planilha em nome dessa conta. Só **você (admin / dono do GAS)** precisa ser editor da planilha.

| Ação | Quem | Como |
|------|------|------|
| Editar **próprio** perfil (nome, e-mail, nível, áreas) | Qualquer membro `active` | Login com **código** no hub → salva via `saveMemberProfile` |
| Foto do perfil | Cada um | Só no navegador (`localStorage`) |
| Mudar **role**, aprovar/revogar, e-mail de outro | **Admin** | Configuração → Usuários (ou editar aba `Membros` na planilha) |
| Editar férias | Dono do registro ou admin | Página Férias no hub |
| Editar planilha manualmente | Quem tiver acesso ao Google Sheet | Opcional para admin; hub recarrega na próxima abertura |

Visitantes (`visitor`) não editam perfil nem publicam férias.

## clasp (opcional)

```bash
cd gas/ferias-bridge
clasp create --type standalone --title "Quality Ferias Bridge"
clasp push
```

Após `clasp push`, atualize a implantação do Web App (mesma URL `/exec` se já publicada).
