#!/usr/bin/env node
/**
 * Pré-compila blocos <script type="text/babel"> para JS puro (sem Babel no browser).
 */
const fs = require('fs');
const path = require('path');
const babel = require('@babel/standalone');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['Comp_ControleSlots.html', 'App_Logica.html'];

function compileBabelHtml(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const re = /<script type="text\/babel">([\s\S]*?)<\/script>/;
  const m = src.match(re);
  if (!m) {
    console.warn('Skip (no babel block):', path.basename(filePath));
    return;
  }
  const compiled = babel.transform(m[1], {
    presets: [['react', { runtime: 'classic' }]],
    filename: path.basename(filePath)
  }).code;
  const out = src.replace(re, '<script>\n' + compiled + '\n</script>');
  fs.writeFileSync(filePath, out);
  console.log('Compiled', path.basename(filePath));
}

TARGETS.forEach(function (name) {
  compileBabelHtml(path.join(ROOT, name));
});
