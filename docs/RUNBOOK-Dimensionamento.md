# Runbook — Dimensionamento no Hub

## Deploy inicial (Apps Script)

1. Na planilha de dimensionamento: **Extensões → Apps Script**
2. `clasp clone <scriptId>` ou copie arquivos de `gas/` para o projeto
3. `clasp push`
4. **Implantar → Nova implantação → Aplicativo da web**
   - Executar como: **Quem acessa**
   - Quem tem acesso: **Somente usuários do domínio** (nubank.com.br)
5. Copie a URL base (`.../exec`)

## Configurar no Hub

1. Admin abre **Configuração → Técnico**
2. Cole a URL: `https://script.google.com/macros/s/.../exec`
3. **Salvar** (publica URL no Gist para o time)
4. Cadastre **e-mail Nubank** de cada analista em **Usuários**

## Adicionar novo slot

1. Planilha `H1.2026` / `H2.2026`: incluir slot na **validação de dados** das colunas I:AR
2. Aba **Controle de Slots**: adicionar linha (atividade, tipo, significado, classificação, conversão)
3. Se aplicável, aba **Conversão Slots**: mapeamento para Base DIM
4. Atualizar `DIM_SLOT_OPTIONS` em `gas/Config_Slots.gs` e `clasp push`

## Checklist de testes (Passo 8)

- [ ] Analista A vê só a própria escala (coluna H = e-mail Google)
- [ ] Editar slot no Hub → reflete na planilha
- [ ] Editar planilha → Hub atualiza em até 60s ou ao clicar Atualizar
- [ ] Slot detalhado (Planilha, Docs…) grava em **Base_Detalhes**
- [ ] Desfazer (4s) reverte na planilha
- [ ] Slot inválido mostra erro no Hub (não falha silenciosa)
- [ ] Break ocupa 2 slots consecutivos
- [ ] Líder: Dim automático e DeepDive executam sem erro
- [ ] E-mail Google ≠ cadastro Hub → aviso amarelo

## Solução de problemas

| Sintoma | Ação |
|---|---|
| "Configure URL da ponte" | Admin preenche URL em Configuração → Técnico |
| "Timeout ao comunicar" | Verificar deploy Web App e login Google |
| Save não aparece na planilha | Verificar validação de dados nas colunas I:AR |
| Aba não encontrada | Confirmar nome `H1.2026` / `H2.2026` na planilha |
