# Pack Bridge (sem planilha)

Intermediário entre o **Quality ID Hub** e o **GitHub Gist**. Membros usam só o **código pessoal**; o token `ghp_` fica nas **Propriedades do script**.

## 1. Criar o projeto

1. [script.google.com](https://script.google.com) → **Novo projeto** (não precisa de planilha).
2. Cole o conteúdo de `PackBridge.gs`.
3. **Projeto → Propriedades do projeto** (ou rode `packConfigureSecrets` uma vez no editor):

| Propriedade | Valor |
|-------------|--------|
| `GIST_ID` | `a82a82743ae0bc3d8887a69fb685d612` |
| `GITHUB_PACK_TOKEN` | PAT com escopo `gist` |
| `FERIAS_SHEET_ID` | ID da planilha Hub (aba **Membros**) — fallback se `getMembers` falhar |
| `FERIAS_BRIDGE_URL` | URL `/exec` da Planilha Hub — fallback para ler membros via `getMembers` |
| `PACK_FILENAME` | `quality-hub-data.json` (opcional) |

No editor, executar:

```javascript
packConfigureSecrets(
  'a82a82743ae0bc3d8887a69fb685d612',
  'ghp_SEU_TOKEN_NOVO',
  '1xv0WyTghWTCiQON16nATiAW7kCqiTpcsK-nKvXWkubA',
  'https://script.google.com/a/macros/nubank.com.br/s/AKfycbx-USlNwZScWOy7qT7Cr1Bcak7sK4t0JCuXLDO6xNDpKgsMxqX8hQWGmXNMnFjj2P-Q/exec'
);
```

## 2. Publicar Web App

**Implantar → Nova implantação → App da web**

- Executar como: **Eu**
- Quem tem acesso: conforme política Nubank (geralmente **Qualquer pessoa** ou domínio `@nubank.com.br`)

Copie a URL `/exec`, ex.:  
`https://script.google.com/a/macros/nubank.com.br/s/XXXX/exec`

## 3. Configurar no Hub

**Configuração → Técnico → URL bridge do pack** (cole a URL `/exec`).

Salve. Membros entram com código — **sem token no navegador**.

## Endpoints (JSON / JSONP)

| `pack` | Quem | Função |
|--------|------|--------|
| `ping` | todos | Saúde |
| `getPack` | leitura | Lê o Gist (sem código) |
| `saveFerias` | membro + código | Publica férias |
| `saveProfile` | membro + código | Publica perfil |
| `patchPack` | editor/admin + código | Salva pack inteiro (modo Editar) |
| `patchPriorities` | editor/admin + código | Salva prioridades da semana |
| `patchAccessUsers` | admin + código | Salva roster de usuários |

JSONP (Hub):  
`.../exec?pack=getPack&payload={}&callback=packCb_1`

## clasp (opcional)

```bash
cd gas/pack-bridge
clasp create --type standalone --title "Quality Pack Bridge"
clasp push
```
