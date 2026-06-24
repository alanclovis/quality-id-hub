function gerarLinhasAnalistas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('H1.2026');
  
  const LIDER = 'gabrielle.prestes';
  const UNIT_PACK = 'Quality ID/VP';
  const DOMINIO = '@nubank.com.br';

  const ANALISTAS_NOVOS = [
    { analista: 'alan.clovis',      distrito: 'Identity' },
    { analista: 'tiago.genangello', distrito: 'Identity' },
    { analista: 'matheus.santos2',  distrito: 'Identity' },
    { analista: 'livia.lyra',       distrito: 'Identity' },
    { analista: 'luciana.ramos',    distrito: 'Identity' },
    { analista: 'evelyn.marconi',   distrito: 'Csat' },
    { analista: 'felipe.rosado',    distrito: 'Csat' },
    { analista: 'mayara.kin',       distrito: 'Csat' },
  ];

  const DIAS_SEMANA = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira'];

  const dataInicio = new Date(2026, 5, 15); // 15/06/2026
  const dataFim = new Date(2026, 5, 26);    // 26/06/2026

  function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  function formatDate(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const novasLinhas = [];

  for (let d = new Date(dataInicio); d <= dataFim; d.setDate(d.getDate() + 1)) {
    const diaSemana = d.getDay(); // 0=dom, 6=sab
    if (diaSemana === 0 || diaSemana === 6) continue; // pula fim de semana

    const nomeDia = DIAS_SEMANA[diaSemana - 1];
    const dataFormatada = formatDate(new Date(d));
    const semana = getWeekNumber(new Date(d));

    ANALISTAS_NOVOS.forEach(a => {
      novasLinhas.push([
        LIDER,
        UNIT_PACK,
        nomeDia,
        dataFormatada,
        semana,
        a.distrito,
        a.analista,
        a.analista + DOMINIO
      ]);
    });
  }

  if (novasLinhas.length === 0) {
    SpreadsheetApp.getUi().alert('Nenhuma linha gerada.');
    return;
  }

  const ultimaLinha = sheet.getLastRow();
  sheet.getRange(ultimaLinha + 1, 1, novasLinhas.length, 8).setValues(novasLinhas);

  SpreadsheetApp.getUi().alert(`${novasLinhas.length} linhas inseridas com sucesso.`);
}