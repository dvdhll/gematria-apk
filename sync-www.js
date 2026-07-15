#!/usr/bin/env node
/**
 * סנכרון www/ מתיקיית האתר — הרץ: node sync-www.js
 *
 * ה-APK צורב עותק של האפליקציה בתוכו (זה מה שמאפשר לו לעבוד בלי אינטרנט), ולכן הוא
 * לא מתעדכן מהאתר לבד. הסקריפט הזה מעתיק את קבצי האתר ומחיל את ההתאמות הייעודיות
 * ל-APK — כדי שלא נשכח אותן ידנית (ככה ה-www התיישן ב-11 גרסאות בפעם הקודמת).
 *
 * אחרי ההרצה:  git add www && git commit -m "sync www" && git push   → הבנייה והפרסום אוטומטיים.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'gematria');
const DST = path.resolve(__dirname, 'www');

// מה נכנס ל-APK. כל השאר (functions/, _headers, server.js, tests, node_modules,
// data/build_*.js …) נשאר בצד — הוא רלוונטי רק לאתר/לבנייה, לא לאפליקציה עצמה.
const FILES = ['index.html', 'sw.js', 'manifest.json', 'icon-192.png', 'icon-512.png',
               'icon-maskable-512.png', 'lishkod-logo.png'];
const DIRS  = ['css', 'js', 'fonts'];
const DATA  = ['verses.v2.json', 'values_list.json', 'meta.json'];   // data/ בלי סקריפטי הבנייה

// התאמות ייעודיות ל-APK, מוחלות על הקבצים אחרי ההעתקה
const PATCHES = [
  { file: 'index.html',
    name: 'class="median" על <html> (מסתיר לוגו לשקוד + באנר התקנה)',
    apply: s => s.replace(/<html([^>]*?)>/, (m, attrs) =>
      /class=/.test(attrs) ? m.replace(/class="([^"]*)"/, (_, c) => `class="${/\bmedian\b/.test(c) ? c : (c + ' median').trim()}"`)
                           : `<html${attrs} class="median">`),
    verify: s => /<html[^>]*class="[^"]*\bmedian\b/.test(s) },
];

const cp = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };
const cpDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const f = path.join(from, e.name), t = path.join(to, e.name);
    e.isDirectory() ? cpDir(f, t) : cp(f, t);
  }
};

if (!fs.existsSync(SRC)) { console.error(`✗ לא נמצאה תיקיית האתר: ${SRC}`); process.exit(1); }

let n = 0;
for (const f of FILES) { const s = path.join(SRC, f); if (fs.existsSync(s)) { cp(s, path.join(DST, f)); n++; } }
for (const d of DIRS)  { const s = path.join(SRC, d); if (fs.existsSync(s)) { cpDir(s, path.join(DST, d)); n++; } }
for (const f of DATA)  { const s = path.join(SRC, 'data', f); if (fs.existsSync(s)) { cp(s, path.join(DST, 'data', f)); n++; } }
console.log(`✓ הועתקו ${n} פריטים מ-${path.basename(SRC)}/ ל-www/`);

for (const p of PATCHES) {
  const file = path.join(DST, p.file);
  const out = p.apply(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, out);
  if (!p.verify(out)) { console.error(`✗ ההתאמה נכשלה: ${p.name}`); process.exit(1); }
  console.log(`✓ הותאם: ${p.name}`);
}

const ver = (fs.readFileSync(path.join(DST, 'js', 'ui.js'), 'utf8').match(/APP_VERSION\s*=\s*'([\d.]+)'/) || [])[1];
console.log(`\n✓ www/ מסונכרן — גרסה ${ver || '?'}\n  להמשך:  git add www && git commit -m "sync www ${ver || ''}" && git push`);
