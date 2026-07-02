#!/usr/bin/env node
/**
 * Validação offline da lógica de filtros/agregação do Deep Dive.
 * Run: node scripts/validate-deep-dive-logic.js
 */

const DD_DISTRITO_MAP = {
  ID: 'Identity',
  VP: 'Victims Prevention',
  Csat: 'Csat',
};

function applyDeepDiveFilters(facts, filters) {
  const distValues = (filters.distritos || []).map((k) => DD_DISTRITO_MAP[k]).filter(Boolean);
  const inicio = filters.dataInicio ? new Date(filters.dataInicio + 'T12:00:00') : null;
  const fim = filters.dataFim ? new Date(filters.dataFim + 'T23:59:59') : null;
  const analistas = filters.analistas || [];

  return facts.filter((row) => {
    if (distValues.length && !distValues.includes(row.distrito)) return false;
    if (analistas.length && !analistas.includes(row.analista)) return false;
    if (inicio && row.dia < inicio) return false;
    if (fim && row.dia > fim) return false;
    if (!filters.incluirBreak && row.item === 'Break') return false;
    if (!filters.incluirAusencia && (row.item === 'AVLB' || row.item === 'AUS')) return false;
    return true;
  });
}

function dd_groupSum(rows, keyField, valField) {
  const m = {};
  rows.forEach((r) => {
    const k = r[keyField];
    if (!m[k]) m[k] = { key: k, slots: 0 };
    m[k].slots += Number(r[valField]) || 0;
  });
  return Object.values(m);
}

function dd_isSignificadoLikeText(text) {
  const s = String(text || '').trim();
  return s.length > 60 || /^slot destinado/i.test(s);
}

function dd_isCoreClassificacao(classificacao) {
  const c = String(classificacao || '').toLowerCase();
  return c.includes('produt') || c.includes('exclusivo') || c.includes('core');
}

function dd_isUnclassifiedLabel(label) {
  return label === 'Sem classificação' || label === 'Não mapeado';
}

function dd_inferClassificacaoFromItem(item) {
  const i = String(item || '').trim();
  if (i === 'Break') return 'Break';
  if (i === 'AUS' || i === 'AVLB') return 'Ausência';
  return '';
}

function dd_normalizeClassificacaoLabel(rawClassificacao, item, mapeado) {
  const raw = String(rawClassificacao || '').trim();

  if (dd_isSignificadoLikeText(raw)) {
    return dd_inferClassificacaoFromItem(item) || 'Sem classificação';
  }
  if (!raw) {
    if (!mapeado) return 'Não mapeado';
    return dd_inferClassificacaoFromItem(item) || 'Sem classificação';
  }

  const lower = raw.toLowerCase();
  if (lower.includes('exclusivo') && lower.includes('csat')) return 'Exclusivo Csat';
  if (lower.includes('exclusivo') && (lower.includes('quality') || lower.includes('qlt'))) return 'Exclusivo quality';
  if (lower.includes('exclusivo')) return 'Exclusivo';
  if (lower.includes('uso geral')) return dd_inferClassificacaoFromItem(item) || 'Uso geral';
  if (lower.includes('break')) return 'Break';
  if (lower.includes('aus') || lower.includes('ausência') || lower.includes('ausencia')) return 'Ausência';
  if (lower.includes('produt') || lower.includes('core')) return 'Core';

  if (raw.length > 40) return raw.slice(0, 37) + '…';
  return raw;
}

const sampleFacts = [
  { semana: 27, dia: new Date('2026-07-02'), distrito: 'Identity', item: 'FR', analista: 'a', slots: 16, horas: 8 },
  { semana: 27, dia: new Date('2026-07-02'), distrito: 'Victims Prevention', item: 'GS - VP', analista: 'b', slots: 6, horas: 3 },
  { semana: 28, dia: new Date('2026-07-09'), distrito: 'Csat', item: 'CSAT', analista: 'c', slots: 8, horas: 4 },
  { semana: 28, dia: new Date('2026-07-09'), distrito: 'Identity', item: 'Break', analista: 'a', slots: 2, horas: 1 },
  { semana: 20, dia: new Date('2026-05-15'), distrito: 'Identity', item: 'FR', analista: 'a', slots: 10, horas: 5 },
];

const enrichedSample = [
  { item: 'CSAT', slots: 10, classificacao: 'Exclusivo de Csat', mapeado: true },
  { item: 'GS - ID', slots: 8, classificacao: 'Exclusivo de quality', mapeado: true },
  { item: 'Break', slots: 2, classificacao: 'Uso geral', mapeado: true },
  { item: 'UNKNOWN', slots: 5, classificacao: '', mapeado: false },
  {
    item: 'BAD',
    slots: 3,
    classificacao: 'Slot destinado ao projeto de feedback loop center - Realizar a tratativa dos casos',
    mapeado: true,
  },
];

function dd_normalizeAnalystKey(s) {
  return String(s || '').toLowerCase().trim().replace(/@.*$/, '');
}

function dd_analistaMatchesFilter(analista, filterList) {
  if (!filterList || !filterList.length) return true;
  const key = dd_normalizeAnalystKey(analista);
  return filterList.some((f) => dd_normalizeAnalystKey(f) === key);
}


let failed = 0;

function assert(name, cond) {
  if (!cond) {
    console.error('FAIL:', name);
    failed++;
  } else {
    console.log('OK:', name);
  }
}

const h2 = applyDeepDiveFilters(sampleFacts, {
  distritos: ['ID', 'VP', 'Csat'],
  analistas: [],
  dataInicio: '2026-07-01',
  dataFim: '',
  incluirBreak: true,
  incluirAusencia: true,
});
assert('H2 filter excludes sem 20', h2.length === 4 && !h2.some((r) => r.semana === 20));

const idOnly = applyDeepDiveFilters(sampleFacts, {
  distritos: ['ID'],
  analistas: [],
  dataInicio: '2026-01-01',
  dataFim: '',
  incluirBreak: true,
  incluirAusencia: true,
});
assert('ID filter', idOnly.every((r) => r.distrito === 'Identity') && idOnly.length === 3);

const noBreak = applyDeepDiveFilters(sampleFacts, {
  distritos: ['ID', 'VP', 'Csat'],
  analistas: [],
  dataInicio: '2026-07-01',
  dataFim: '',
  incluirBreak: false,
  incluirAusencia: true,
});
assert('Exclude break', !noBreak.some((r) => r.item === 'Break'));

const totals = dd_groupSum(h2, 'item', 'slots');
const sumSlots = h2.reduce((t, r) => t + r.slots, 0);
const sumGrouped = totals.reduce((t, g) => t + g.slots, 0);
assert('Grouped totals match', sumSlots === sumGrouped && sumSlots === 32);

assert('Normalize Exclusivo de Csat', dd_normalizeClassificacaoLabel('Exclusivo de Csat', 'CSAT', true) === 'Exclusivo Csat');
assert('Normalize Exclusivo de quality', dd_normalizeClassificacaoLabel('Exclusivo de quality', 'GS - ID', true) === 'Exclusivo quality');
assert('Unmapped slot', dd_normalizeClassificacaoLabel('', 'FOO', false) === 'Não mapeado');
assert('Significado-like falls back', dd_normalizeClassificacaoLabel('Slot destinado ao projeto X', 'BAD', true) === 'Sem classificação');
assert('Break from uso geral', dd_normalizeClassificacaoLabel('Uso geral', 'Break', true) === 'Break');

const coreSlots = enrichedSample.reduce((t, r) => {
  if (dd_isSignificadoLikeText(r.classificacao)) return t;
  return t + (dd_isCoreClassificacao(r.classificacao) ? r.slots : 0);
}, 0);
assert('Core slots count', coreSlots === 18);

const classMap = {};
enrichedSample.forEach((r) => {
  const c = dd_normalizeClassificacaoLabel(r.classificacao, r.item, r.mapeado);
  classMap[c] = (classMap[c] || 0) + r.slots;
});
assert('Classification groups normalized', classMap['Exclusivo Csat'] === 10 && classMap['Não mapeado'] === 5);

const mappedPct = enrichedSample.filter((r) => r.mapeado).reduce((t, r) => t + r.slots, 0);
const totalEnriched = enrichedSample.reduce((t, r) => t + r.slots, 0);
assert('Mapped pct', Math.round(mappedPct / totalEnriched * 100) === 82);

assert('Analyst filter matches email', dd_analistaMatchesFilter('alan.clovis@nubank.com.br', ['alan.clovis']));
assert('Analyst filter rejects other', !dd_analistaMatchesFilter('tiago.genangeli@nubank.com.br', ['alan.clovis']));
assert('Analyst filter empty passes', dd_analistaMatchesFilter('any@nubank.com.br', []));

if (failed) {
  process.exit(1);
}
console.log('\nAll Deep Dive logic checks passed.');
