#!/usr/bin/env node
/**
 * Sincroniza dim-slot-dictionary.json e gas/SlotDictionaryStatic.gs
 * a partir de gas/Config_Slots.html (STATIC_SLOT_DATA).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const configPath = path.join(ROOT, 'gas/Config_Slots.html');
const jsonPath = path.join(ROOT, 'dim-slot-dictionary.json');
const gsPath = path.join(ROOT, 'gas/SlotDictionaryStatic.gs');

const src = fs.readFileSync(configPath, 'utf8');
const m = src.match(/const STATIC_SLOT_DATA = (\[[\s\S]*?\n\]);/);
if (!m) {
  console.error('STATIC_SLOT_DATA not found in Config_Slots.html');
  process.exit(1);
}

const data = eval(m[1]);
const items = data.map(function (r) {
  return {
    atividade: r.atividade,
    tipoSlot: r.tipo,
    significado: r.significado,
    classificacao: r.classificacao,
    conversao: r.conversao || ''
  };
});

fs.writeFileSync(jsonPath, JSON.stringify({ items: items }, null, 2) + '\n');

const gsContent = `/**
 * Gerado por scripts/sync-slot-dictionary.js — não editar manualmente.
 * Fonte: gas/Config_Slots.html (STATIC_SLOT_DATA)
 */
function hubGetStaticSlotDictionary_() {
  return JSON.parse(${JSON.stringify(JSON.stringify({ items: items }))});
}
`;

fs.writeFileSync(gsPath, gsContent);
console.log('Synced', items.length, 'slots ->', path.basename(jsonPath), '+', path.basename(gsPath));
