/**
 * One-shot: scaffold H2.2026 analyst rows (week 27+).
 * Run via Apps Script API devMode — not part of production menu.
 */
function testClaspRun_() {
  return 'ok';
}

function populateH2_2026() {
  const TAB = 'H2.2026';
  const LIDER = 'gabrielle.prestes';
  const UNIT_PACK = 'Quality ID/VP';
  const DOMINIO = '@nubank.com.br';
  const DIAS_SEMANA = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira'];

  const ANALISTAS_ORDEM = [
    { analista: 'alan.clovis', distrito: 'Identity' },
    { analista: 'evelyn.marconi', distrito: 'Identity' },
    { analista: 'felipe.rosado', distrito: 'Identity' },
    { analista: 'livia.lyra', distrito: 'Identity' },
    { analista: 'luciana.ramos', distrito: 'Identity' },
    { analista: 'matheus.santos2', distrito: 'Identity' },
    { analista: 'mayara.kin', distrito: 'Csat' },
    { analista: 'tiago.genangello', distrito: 'Identity' },
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TAB);
  if (!sheet) {
    const h1 = ss.getSheetByName('H1.2026');
    if (!h1) throw new Error('H1.2026 not found — cannot duplicate structure');
    sheet = h1.copyTo(ss).setName(TAB);
  }

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

  // H2: weeks 27–53 (Mon–Fri only)
  const dataInicio = new Date(2026, 5, 29); // 2026-06-29 = Monday week 27
  const dataFim = new Date(2026, 11, 31);   // through end of 2026

  const novasLinhas = [];
  for (let d = new Date(dataInicio); d <= dataFim; d.setDate(d.getDate() + 1)) {
    const diaSemana = d.getDay();
    if (diaSemana === 0 || diaSemana === 6) continue;
    const semana = getWeekNumber(new Date(d));
    if (semana < 27) continue;

    const nomeDia = DIAS_SEMANA[diaSemana - 1];
    const dataFormatada = formatDate(new Date(d));

    ANALISTAS_ORDEM.forEach(function (a) {
      novasLinhas.push([
        LIDER,
        UNIT_PACK,
        nomeDia,
        dataFormatada,
        semana,
        a.distrito,
        a.analista,
        a.analista + DOMINIO,
      ]);
    });
  }

  if (novasLinhas.length === 0) throw new Error('No rows generated');

  // Keep header row; replace data rows
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  sheet.getRange(2, 1, novasLinhas.length, 8).setValues(novasLinhas);

  return JSON.stringify({
    tab: TAB,
    rowsWritten: novasLinhas.length,
    firstRow: novasLinhas[0],
    lastRow: novasLinhas[novasLinhas.length - 1],
    weekRange: '27-53',
    analystOrder: ANALISTAS_ORDEM.map(function (a) { return a.analista; }),
  });
}

function inspectH2_2026() {
  const TAB = 'H2.2026';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TAB);
  if (!sheet) return JSON.stringify({ error: 'tab not found', tabs: ss.getSheets().map(function (s) { return s.getName(); }) });
  const lastRow = Math.min(sheet.getLastRow(), 50);
  const rows = lastRow < 1 ? [] : sheet.getRange(1, 1, lastRow, 8).getDisplayValues();
  return JSON.stringify({ tab: TAB, lastRow: sheet.getLastRow(), preview: rows });
}
