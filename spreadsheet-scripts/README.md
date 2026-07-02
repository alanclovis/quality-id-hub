# Deep Dive — painel único na planilha

Painel modal estilo **Quality Insights**: filtros no topo, KPIs e gráficos de barras — **tudo carrega no próprio painel**, sem abas extras.

## Uso

**Deep Dive → Abrir painel…** (ou botão **Atualizar Informações**)

- Atalhos: **Hoje | Semana | Mês | H2**
- Distritos: **ID / VP / Csat**
- Datas customizadas + filtro de analistas
- Botão **analisar** → KPIs + Por slot + Por analista + Por distrito + Por dia + Detalhes

## Deploy

```bash
cd gas && npx clasp push
```

Arquivo: [`gas/Deep Dive.js`](../gas/Deep%20Dive.js)
