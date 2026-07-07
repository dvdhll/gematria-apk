/* search.js — חיפוש הפוך במאגר התנ"ך (מילים / צירופים / פסוקים) + הקשר מלא */
(function (root) {
  'use strict';
  const G = root.Gem;

  let VERSES = null;      // [{r,t,v,g}]  t=חשוף v=מנוקד
  let WORDS = null;       // Map: word -> hechrechi
  let loading = null;

  function load() {
    if (loading) return loading;
    loading = fetch('data/verses.v2.json')
      .then(r => r.json())
      .then(data => {
        VERSES = data;
        WORDS = new Map();
        for (const v of VERSES) {
          for (const w of v.t.split(' ')) {
            if (!WORDS.has(w)) WORDS.set(w, G.hechrechi(w));
          }
        }
        return { verses: VERSES.length, words: WORDS.size };
      });
    return loading;
  }

  function valueByMethod(text, method) {
    switch (method) {
      case 'siduri': return G.siduri(text);
      case 'katan':  return G.katan(text);
      case 'kidmi':  return G.kidmi(text);
      default:       return G.hechrechi(text);
    }
  }

  // חיפוש מילים בודדות ששוות לערך
  function searchWords(value, method, limit = 400) {
    if (!WORDS) return [];
    const out = [];
    for (const [w, hv] of WORDS) {
      const v = method === 'hechrechi' ? hv : valueByMethod(w, method);
      if (v === value) { out.push(w); if (out.length >= limit) break; }
    }
    out.sort((a, b) => a.length - b.length || a.localeCompare(b, 'he'));
    return out;
  }

  // חיפוש צירופים: רצפים של 2..maxSpan מילים עוקבות בפסוק ששווים לערך
  function searchPhrases(value, method, maxSpan = 5, limit = 300) {
    if (!VERSES) return [];
    const seen = new Map(); // phrase -> {p, count, refs:[]}
    outer:
    for (const v of VERSES) {
      const ws = v.t.split(' ');
      const vals = ws.map(w => valueByMethod(w, method));
      for (let i = 0; i < ws.length; i++) {
        let sum = 0;
        for (let s = 0; s < maxSpan && i + s < ws.length; s++) {
          sum += vals[i + s];
          if (s === 0) { if (sum > value) break; continue; } // מילה בודדת -> בטאב "מילים"
          if (sum === value) {
            const p = ws.slice(i, i + s + 1).join(' ');
            let e = seen.get(p);
            if (!e) { e = { p, count: 0, refs: [] }; seen.set(p, e); }
            e.count++;
            if (e.refs.length < 5) e.refs.push(v.r);
            if (seen.size >= limit) break outer;
          }
          if (sum > value) break;             // ערכים חיוביים — אין טעם להאריך
        }
      }
    }
    const out = [...seen.values()];
    // קצרים ונפוצים קודם
    out.sort((a, b) => a.p.length - b.p.length || b.count - a.count || a.p.localeCompare(b.p, 'he'));
    return out;
  }

  // חיפוש פסוקים שלמים ששווים לערך
  function searchVerses(value, method, limit = 200) {
    if (!VERSES) return [];
    const out = [];
    for (const v of VERSES) {
      const val = method === 'hechrechi' ? v.g : valueByMethod(v.t, method);
      if (val === value) { out.push(v); if (out.length >= limit) break; }
    }
    return out;
  }

  // כל ההיקרויות של מילה/צירוף (בגבולות מילים) — להקשר מלא
  function occurrences(phrase, limit = 100) {
    if (!VERSES) return [];
    const needle = ' ' + phrase.trim() + ' ';
    const out = [];
    for (let i = 0; i < VERSES.length; i++) {
      const hay = ' ' + VERSES[i].t + ' ';
      if (hay.includes(needle)) { out.push(VERSES[i]); if (out.length >= limit) break; }
    }
    return out;
  }

  // הדגשת צירוף חשוף בתוך פסוק מנוקד: מפרקים את המנוקד לאסימונים
  // (רווח/מקף כמפרידים), ממפים כל אסימון לצורתו החשופה, ומאתרים חלון תואם.
  const RE_NIQQUD = /[ְ-ׇּׁׂ]/g;
  function stripToken(tok) { return tok.replace(RE_NIQQUD, ''); }
  function highlight(vocalized, phrase) {
    const parts = vocalized.split(/(\s+|־)/);   // שומר את המפרידים
    const words = phrase.split(' ');
    // אינדקסי האסימונים שאינם מפרידים
    const idx = [];
    for (let i = 0; i < parts.length; i++) {
      if (!/^(\s+|־)$/.test(parts[i]) && parts[i]) idx.push(i);
    }
    const plain = idx.map(i => stripToken(parts[i]));
    for (let s = 0; s + words.length <= plain.length; s++) {
      let ok = true;
      for (let k = 0; k < words.length; k++) if (plain[s + k] !== words[k]) { ok = false; break; }
      if (ok) {
        const from = idx[s], to = idx[s + words.length - 1];
        return parts.map((p, i) => (i === from ? '<mark>' + p : p) + (i === to ? '</mark>' : '')).join('');
      }
    }
    return vocalized; // לא נמצא — מחזיר בלי הדגשה
  }

  root.GemSearch = { load, searchWords, searchPhrases, searchVerses, valueByMethod,
    occurrences, highlight,
    get ready() { return !!VERSES; } };
})(typeof window !== 'undefined' ? window : globalThis);
