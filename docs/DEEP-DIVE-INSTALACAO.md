# Deep Dive — instalação na planilha

Referência completa para o painel **Deep Dive** (sem alterar hub nem GAS deployado).

## Arquivo fonte

Copie para o Apps Script bound da planilha:

- [`spreadsheet-scripts/Deep Dive.js`](../spreadsheet-scripts/Deep%20Dive.js)

## Checklist pós-instalação

- [ ] Menu **Deep Dive** aparece ao lado de **Dimensionamento**
- [ ] Modal abre com filtros ID / VP / Csat, analistas e período
- [ ] **Atualizar painéis** gera abas `Deep Dive Resumo`, etc.
- [ ] Botão flutuante **Atualizar Informações** funciona (últimos filtros)
- [ ] Totais de slots batem entre Resumo, Por Slot e Por Analista
- [ ] Filtro H2 (desde 01/07/2026) exclui semanas anteriores

## Validação local (repo)

```bash
node scripts/validate-deep-dive-logic.js
```

## Estrutura de dados

Fontes: `H1.2026`, `H2.2026`, `Controle de Slots`, `Base_Detalhes`.

| Coluna planilha | Campo |
|-----------------|-------|
| D | Data |
| E | Semana |
| F | Distrito |
| G | Analista |
| H | E-mail |
| I+ | Slots horários |

Mapeamento filtro → distrito:

| UI | Planilha |
|----|----------|
| ID | Identity |
| VP | Victims Prevention |
| Csat | Csat |
