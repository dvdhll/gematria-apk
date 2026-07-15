/* ui.js — קישור הממשק למנוע */
(function () {
  'use strict';
  const APP_VERSION = '1.0.34';   // לעדכן יחד עם גרסת ה-service worker
  const G = window.Gem, S = window.GemSearch;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  // רשימת שיטות ברמת המילה
  const METHODS = [
    { key: 'hechrechi', name: 'הכרחי', desc: 'הערך הרגיל', primary: true, fn: t => G.hechrechi(t) },
    { key: 'siduri',    name: 'סידורי', desc: 'מיקום האות 1–22', fn: t => G.siduri(t) },
    { key: 'katan',     name: 'קטן', desc: 'ספרה מצומצמת לכל אות', fn: t => G.katan(t) },
    { key: 'kidmi',     name: 'קדמי', desc: 'סכום מצטבר', fn: t => G.kidmi(t) },
    { key: 'katanMispari', name: 'קטן מספרי', desc: 'כל מילה מצומצמת לספרה', fn: t => G.katanMispari(t) },
    { key: 'katanAcharon', name: 'קטן מספרי אחרון', desc: 'צמצום לספרה בודדת', fn: t => G.katanMispariAcharon(t) },
    { key: 'gadol',     name: 'גדול', desc: 'סופיות 500–900', fn: t => G.hechrechi(t, { sofit: true }) },
    { key: 'milui',     name: 'מילוי (שמי)', desc: 'איות שם כל אות', fn: t => G.milui(t) },
    { key: 'imHakolel', name: 'עם הכולל', desc: 'הכרחי <span class="plus">﬩</span> 1', fn: t => G.imHakolel(t) },
    { key: 'mosaf',     name: 'מוסף', desc: 'הכרחי <span class="plus">﬩</span> מספר האותיות', fn: t => G.mosaf(t) },
    { key: 'merubaKlali', name: 'מרובע כללי', desc: 'הערך בריבוע', fn: t => G.merubaKlali(t) },
    { key: 'merubaPrati', name: 'מרובע פרטי', desc: 'סכום ריבועי האותיות', fn: t => G.merubaPrati(t) },
    { key: 'hakaah',    name: 'הכאה', desc: 'מכפלת האותיות', fn: t => G.hakaah(t) },
    // count: ספירה, לא ערך — בביטוי חשבוני לא מחילים עליה את הפעולה (מה זה "אותיות כפול
    // אותיות"?). היא תמיד סופרת את כל הקלט; סימני הפעולה ממילא מסוננים ע"י onlyLetters/words.
    { key: 'letterCount', name: 'מספר אותיות', desc: 'ספירת האותיות', count: true, fn: t => G.letterCount(t) },
    { key: 'wordCount',   name: 'מספר מילים', desc: 'ספירת המילים', count: true, fn: t => G.wordCount(t) },
  ];

  let currentText = '';
  let currentNum = 0;
  let currentExpr = null;    // {tokens} כשהקלט הוא ביטוי חשבוני, אחרת null
  let currentResult = null;  // תוצאת הביטוי בערך הכרחי (יכול להיות שבור/שלילי)

  // ערך של שיטה עבור הקלט הנוכחי — דרך הביטוי אם יש, אחרת ישירות על הטקסט.
  // plain=true (שיטות ספירה) → תמיד על הטקסט המלא, בלי להחיל את הפעולה.
  function methodValue(fn, plain){
    return (currentExpr && !plain) ? G.evalExprWith(currentExpr.tokens, fn) : fn(currentText);
  }

  // פירוט ויזואלי של הביטוי בשיטה נתונה: "אב (3) ﬩ גד (7)".
  // sep — לשיטות ספירה, שבהן הפעולה לא מוחלת, מפרידים בנקודה במקום בסימן הפעולה.
  const OP_SYM = { '+':'﬩', '-':'−', '*':'×', '/':'÷', '^':'^' };
  function exprBreakdownHTML(fn, sep){
    return currentExpr.tokens.map(t => {
      if (t.type === 'op') return `<span class="expr-op">${sep || OP_SYM[t.op]}</span>`;
      if (t.type === 'num') return `<span class="expr-opnd" dir="ltr">${t.text}</span>`;
      return `<span class="expr-opnd">${t.text} <span class="expr-val" dir="ltr">(${fmtNum(fn(t.text))})</span></span>`;
    }).join(' ');
  }

  function isNumeric(s) { return /^\s*\d+\s*$/.test(s); }

  // המרה חיה בשדה: '+' → הפלוס העברי ﬩ (U+FB29), כמו בכל שאר האפליקציה.
  // בטוח: ﬩ הוא תו-מפריד ולא אות עברית חזקה, ולכן dir="auto" עדיין נותן LTR לביטוי
  // מספרי. שני התווים באורך יחידת-קוד אחת, אז מיקום הסמן נשמר. המנוע מנרמל ﬩→+ בחזרה.
  function heifyPlus(el) {
    if (el.value.indexOf('+') < 0) return;
    const pos = el.selectionStart;
    el.value = el.value.replace(/\+/g, '﬩');
    try { el.setSelectionRange(pos, pos); } catch (_) {}
  }

  function refresh() {
    const raw = $('mainInput').value;
    currentText = raw;
    const sb = $('searchBox'); if (sb) sb.classList.toggle('has-text', raw.length > 0);
    const expr = G.parseExpr(raw);
    currentExpr = expr.isExpr ? expr : null;
    const letters = G.onlyLetters(raw);
    if (currentExpr) {
      currentResult = G.evalExprWith(currentExpr.tokens, G.hechrechi);
      // ניתוח מספרי (חיפוש/ראשוניים/צורני) רק על תוצאה שלמה חיובית
      currentNum = Number.isInteger(currentResult) ? currentResult : 0;
    } else if (letters) {
      currentResult = null;
      currentNum = G.hechrechi(raw);
    } else if (isNumeric(raw)) {
      currentResult = null;
      currentNum = parseInt(raw.trim(), 10);
    } else {
      currentResult = null;
      currentNum = 0;
    }
    renderHeadline(letters);
    renderValues(letters);
    renderNumProps();
    renderRavList();
    autoFillPair();
    renderOps(letters);
    renderPrimes();
    renderFigurate();
    renderSeries();
    // עדכון ברירת מחדל לחיפוש + ריצה מחדש אם טאב החיפוש פתוח (הצבה תכנותית לא יורה input!)
    $('searchValue').value = currentNum;
    if (S.ready && !$('tab-search').hidden) runSearch();
  }

  // מילוי אוטומטי של ההכאה הפרטית: שתי מילים שוות-אורך במחשבון
  function autoFillPair() {
    if (currentExpr) return;   // בביטוי לא ממלאים אוטומטית את ההכאה הפרטית
    const ws = G.words(currentText);
    if (ws.length === 2 && G.onlyLetters(ws[0]).length === G.onlyLetters(ws[1]).length) {
      $('opA').value = ws[0];
      $('opB').value = ws[1];
    }
  }

  // מספר -> אותיות עבריות (238 -> רל"ח)
  function heLetters(n) {
    if (!Number.isInteger(n) || n < 1 || n > 9999) return '';
    let s = '', rest = n;
    const th = Math.floor(rest / 1000);
    if (th) { s += heLetters(th).replace(/["']/g, '') + '׳'; rest %= 1000; if (!rest) return s; }
    while (rest >= 400) { s += 'ת'; rest -= 400; }
    s += ['', 'ק', 'ר', 'ש'][Math.floor(rest / 100)] || ''; rest %= 100;
    if (rest === 15) s += 'טו';
    else if (rest === 16) s += 'טז';
    else {
      s += ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'][Math.floor(rest / 10)] || '';
      s += ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'][rest % 10] || '';
    }
    // גרשיים לפני האות האחרונה (אם אין כבר גרש אלפים בסוף)
    const letters = s.replace(/׳/g, '');
    if (letters.length > 1 && !s.endsWith('׳')) s = s.slice(0, -1) + '"' + s.slice(-1);
    else if (letters.length === 1 && !s.endsWith('׳')) s += "'";
    return s;
  }

  function renderHeadline(letters) {
    const h = $('headline');
    const heForm = heLetters(currentNum);
    if (currentExpr) {
      const isInt = Number.isInteger(currentResult);
      h.innerHTML = `<div class="big">${fmtNum(currentResult)}</div>
        <span class="big-label">תוצאה${isInt && heForm ? ' · ' + heForm : ''}</span>
        <div class="sub expr-line">${exprBreakdownHTML(G.hechrechi)}</div>`;
    } else if (letters) {
      h.innerHTML = `<div class="big">${G.hechrechi(currentText)}</div>
        <span class="big-label">ערך הכרחי${heForm ? ' · ' + heForm : ''}</span>
        <div class="sub">${plural(G.letterCount(currentText), 'אות אחת', 'אותיות')} · ${plural(G.wordCount(currentText), 'מילה אחת', 'מילים')}</div>`;
    } else if (currentNum) {
      h.innerHTML = `<div class="big">${currentNum}</div><span class="big-label">מספר${heForm ? ' · ' + heForm : ''}</span>`;
    } else {
      h.innerHTML = `<div class="sub">הקלידו טקסט עברי, מספר, או פעולת חשבון — למשל <span dir="ltr">אב ﬩ גד</span> או <span dir="ltr">5 × 7</span></div>`;
    }
  }

  function renderValues(letters) {
    const grid = $('valuesGrid');
    grid.innerHTML = '';
    if (!letters) {
      const msg = currentExpr
        ? '— פעולה בין מספרים בלבד. הזינו מילה עברית כדי לראות את הפעולה בכל השיטות —'
        : '— הזן טקסט עברי כדי לראות את ערכי המילה —';
      grid.innerHTML = `<p class="sub" style="grid-column:1/-1;color:var(--muted)">${msg}</p>`;
      $('breakdown').hidden = true;
      return;
    }
    METHODS.forEach(m => {
      const v = methodValue(m.fn, m.count);
      const disp = fmtNum(v);
      const card = el('div', 'val-card' + (m.primary ? ' primary' : ''));
      card.innerHTML = `<div class="name">${m.name}</div><div class="value${String(disp).length > 9 ? ' long' : ''}">${disp}</div><div class="desc">${m.desc}</div>`;
      card.onclick = () => showBreakdown(m);
      grid.appendChild(card);
    });
  }

  function showBreakdown(m) {
    const b = $('breakdown');
    b.hidden = false;
    // מצב ביטוי: הצג את הפעולה על-פני האופרנדים בשיטה זו
    if (currentExpr) {
      const value = methodValue(m.fn, m.count);
      const canSearch = Number.isInteger(value) && value >= 2 && value <= 500000;
      b.innerHTML = `<h4>${m.name}: <span class="hl">${fmtNum(value)}</span></h4>
        <div class="sub expr-line">${exprBreakdownHTML(m.fn, m.count ? '·' : null)} ${m.count ? '→ סה״כ' : '='} <b class="hl">${fmtNum(value)}</b></div>` +
        (canSearch ? `<div class="search-link"><button class="chip" onclick="GemUI.searchFor(${value},'hechrechi')">🔍 מצא בתנ״ך מילים/פסוקים ששווים ${value}</button></div>` : '');
      return;
    }
    const value = m.fn(currentText);
    let rows = '';
    // פירוט אות-אות עבור השיטות הישירות
    const perLetter = { hechrechi:'hechrechi', siduri:'siduri', katan:'katan', kidmi:'kidmi', gadol:'hechrechi' };
    if (perLetter[m.key]) {
      const field = perLetter[m.key], sofit = (m.key === 'gadol');
      const chips = [...G.onlyLetters(currentText)].map(ch =>
        `<div class="letter-chip"><span class="l">${ch}</span><span class="v">${G.letterValue(ch, field, sofit)}</span></div>`).join('');
      rows = `<div class="letters-row">${chips}</div>`;
    } else if (m.key === 'hakaah') {
      const parts = [...G.onlyLetters(currentText)].map(ch => G.letterValue(ch,'hechrechi'));
      rows = `<div class="sub">${parts.join(' × ')} = <b class="hl">${value}</b></div>`;
    } else if (m.key === 'merubaPrati') {
      const parts = [...G.onlyLetters(currentText)].map(ch => { const x=G.letterValue(ch,'hechrechi'); return `${x}²`; });
      rows = `<div class="sub">${parts.join(' <span class="plus">﬩</span> ')} = <b class="hl">${value}</b></div>`;
    } else if (m.key === 'milui') {
      const chips = [...G.onlyLetters(currentText)].map(ch => {
        const base = G.FINAL_TO_BASE[ch] || ch; const name = G.MILUI[base] || ch;
        return `<div class="letter-chip"><span class="l">${name}</span><span class="v">${G.hechrechi(name)}</span></div>`;
      }).join('');
      rows = `<div class="letters-row">${chips}</div>`;
    }
    b.innerHTML = `<h4>${m.name}: <span class="hl">${value}</span></h4>${rows}
      <div class="search-link"><button class="chip" onclick="GemUI.searchFor(${value},'${m.key==='siduri'?'siduri':m.key==='katan'?'katan':m.key==='kidmi'?'kidmi':'hechrechi'}')">🔍 מצא בתנ״ך מילים/פסוקים ששווים ${value}</button></div>`;
  }

  // ---- פעולות ----
  function renderOps(letters) {
    renderHakaahPratit();
    // ממוצע
    const avg = $('avgResult');
    if (currentExpr) {
      avg.innerHTML = '<span class="sub">— הממוצע חל על טקסט, לא על פעולת חשבון —</span>';
    } else if (letters) {
      const byL = G.memutza(currentText, 'letters');
      const byW = G.memutza(currentText, 'words');
      let extra = '';
      if (byL.integer) {
        // כנפיים של שני איברים סביב הממוצע? נציג את הממוצע כשלם.
        extra = `<div class="eq-note">הממוצע הוא מספר שלם: <b class="hl">${byL.avg}</b></div>`;
      }
      avg.innerHTML = `לפי אותיות: <span class="math">${byL.value} ÷ ${byL.count} = <b class="r-big">${round(byL.avg)}</b></span>` +
        (byW.count > 1 ? `<br>לפי מילים: <span class="math">${byW.value} ÷ ${byW.count} = <b class="hl">${round(byW.avg)}</b></span>` : '') + extra;
    } else avg.innerHTML = '<span class="sub">הזן טקסט.</span>';
    // נקודה אמצעית
    const mid = $('midResult');
    if (currentNum) {
      const mp = G.midpoint(currentNum);
      mid.innerHTML = mp.type === 'odd'
        ? `${currentNum} אי-זוגי ← נקודה אמצעית = <b class="r-big">${mp.middle}</b> <span class="sub">(סימון <span dir="ltr">${currentNum} ·&gt; ${mp.middle}</span>)</span>`
        : `${currentNum} זוגי ← אין נקודה אמצעית. יחס ״שלם וחצי״: <span dir="ltr">${currentNum} ↔ <b class="r-big">${mp.half}</b></span>`;
    } else mid.innerHTML = '<span class="sub">—</span>';
  }

  function renderHakaahPratit() {
    const a = $('opA').value, b = $('opB').value;
    const res = G.hakaahPratit(a, b);
    const box = $('opResult');
    if (res.error) { box.innerHTML = `<div class="eq-note">${res.error} (${res.len1} מול ${res.len2})</div>`; return; }
    const rows = res.parts.map(p => `<td>${p.a}·${p.b}<br><b class="math">${p.v1}×${p.v2}</b><br>${p.prod}</td>`).join('');
    box.innerHTML = `<table><tr>${rows}</tr></table>
      <div style="margin-top:8px">סכום = <b class="r-big">${res.total}</b></div>`;
  }

  // רשימת הערכים של הרב ("ערכים ומראי מקומות") — נטענת פעם אחת
  let VALUES_LIST = null;
  let VALUES_KEYS = [];   // המספרים ברשימה, ממוינים — לדפדוף לפי מספרים
  function loadValuesList() {
    fetch('data/values_list.json')
      .then(r => r.json())
      .then(d => {
        VALUES_LIST = d;
        VALUES_KEYS = Object.keys(d).map(Number).sort((a, b) => a - b);
        renderRavList();
      })
      .catch(() => {});
  }
  function gotoNum(n) {
    $('mainInput').value = String(n);
    refresh();
  }
  function renderRavList() {
    const box = $('ravList');
    if (!box || !VALUES_LIST) return;
    const n = currentNum;
    if (!n) { box.hidden = true; box.innerHTML = ''; return; }
    const entries = VALUES_LIST[n] || [];
    // דפדוף לפי מספרים: הקודם/הבא שיש להם ערכים ברשימה
    const prev = [...VALUES_KEYS].reverse().find(k => k < n);
    const next = VALUES_KEYS.find(k => k > n);
    // RTL: "הקודם" בימין עם חץ ימינה בצד החיצוני; "הבא" בשמאל עם חץ שמאלה
    const nav =
      `<div class="rav-nav">
        ${prev ? `<button class="rav-go" data-go="${prev}">${prev} ›</button>` : '<span></span>'}
        <span class="rav-nav-label">דפדוף ברשימה לפי מספרים</span>
        ${next ? `<button class="rav-go" data-go="${next}">‹ ${next}</button>` : '<span></span>'}
      </div>`;
    box.hidden = false;
    box.innerHTML = `<h4>ערכים · <span class="hl">${n}</span></h4>` +
      (entries.length
        ? entries.map(e => `<div class="rav-entry">${e}</div>`).join('')
        : `<div class="rav-entry sub" style="color:var(--muted)">אין ערכים למספר ${n} ברשימה.</div>`) +
      nav +
      `<div class="rav-src">מתוך רשימת הערכים (סיון תשפ"ו)</div>`;
    box.querySelectorAll('.rav-go').forEach(b => b.onclick = () => gotoNum(parseInt(b.dataset.go, 10)));
  }

  // פס תכונות המספר במסך הראשי (מתחת לרשת הערכים)
  function renderNumProps() {
    const box = $('numProps');
    const n = currentNum;
    if (!n || n < 2) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;

    const f = G.factorize(n);
    const prime = G.isPrimeNum(n);
    const dv = G.divisorsOf(n);
    const ys = G.yesod(n);
    const mk = G.makor(n);

    const items = [];
    if (prime) {
      const idx = G.primeIndex(n);
      items.push(`<span class="np-item np-prime">ראשוני!${idx ? ` ה-<b>${idx}</b> בסדרה` : ''}</span>`);
    } else {
      items.push(`<span class="np-item"><span class="np-label">פירוק</span><b class="math">${f.map(x => x.p + sup(x.k)).join('×')}</b></span>`);
    }
    items.push(`<span class="np-item"><span class="np-label">סכום מחלקים</span><b>${dv.sum}</b></span>`);
    if (!prime && ys != null) items.push(`<span class="np-item"><span class="np-label">יסוד</span><b>${ys}</b></span>`);
    if (mk && !prime) items.push(`<span class="np-item"><span class="np-label">מקור</span><b>${mk.value}</b></span>`);
    if (mk && !prime && ys != null) items.push(`<span class="np-item"><span class="np-label">יסוד<span class="plus">﬩</span>מקור</span><b>${ys + mk.value}</b></span>`);
    // זיהוי צורני — רק אם יש
    const figs = G.identifyFigurate(n);
    figs.forEach(h => items.push(`<span class="np-item np-fig">${G.FIGURATE[h.type].he} ה-${h.index}</span>`));

    box.innerHTML = `<span class="np-title">המספר ${n}:</span> ${items.join('')} <button class="np-more">לפרטים ←</button>`;
    box.querySelector('.np-more').onclick = () => { switchTab('primes'); history.replaceState(null, '', '#primes'); };
  }

  // ---- ראשוניים ----
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = k => k === 1 ? '' : String(k).split('').map(d => SUP[+d]).join('');
  // כפתור חיפוש-בתנ"ך קטן ליד תוצאה
  const findBtn = v => (v >= 2 && v <= 500000)
    ? ` <button class="chip mini-find" onclick="GemUI.searchFor(${v},'hechrechi')">🔍 ${v} בתנ״ך</button>` : '';

  function renderPrimes() {
    const n = currentNum;
    const boxes = ['primeFactor','primeDivisors','primeYesod','primeMakor','primeYM'];
    if (!n || n < 2) { boxes.forEach(id => $(id).innerHTML = '<span class="sub">הזן טקסט או מספר (2 ומעלה).</span>'); return; }

    const f = G.factorize(n);
    // פירוק
    if (G.isPrimeNum(n)) {
      const idx = G.primeIndex(n);
      $('primeFactor').innerHTML = `<b class="r-big">${n}</b> ראשוני!` +
        (idx ? ` <span class="eq-note" style="display:inline-block">ה-<b>${idx}</b> בסדרת הראשוניים (כשמונים את 1: 1, 2, 3, 5, 7, 11…)</span>` : '');
    } else {
      $('primeFactor').innerHTML = `<span class="math">${n} = <b class="r-big">${f.map(x => x.p + sup(x.k)).join(' × ')}</b></span>`;
    }

    // מחלקים
    const dv = G.divisorsOf(n);
    const many = dv.list.length > 48;
    $('primeDivisors').innerHTML =
      `<div class="series-list">${(many ? dv.list.slice(0, 48) : dv.list).join(' ')}${many ? ' …' : ''}</div>
       <div style="margin-top:6px">${dv.list.length} מחלקים · סכום: <b class="r-big">${dv.sum}</b>${findBtn(dv.sum)}</div>`;

    // יסוד
    const ys = G.yesod(n);
    $('primeYesod').innerHTML = G.isPrimeNum(n)
      ? `<span class="sub">מספר ראשוני — היסוד הוא המספר עצמו: <b class="hl">${ys}</b></span>`
      : `<span class="math">${f.map(x => Array(x.k).fill(x.p).join(' <span class="plus">﬩</span> ')).join(' <span class="plus">﬩</span> ')} = <b class="r-big">${ys}</b></span>${findBtn(ys)}`;

    // מקור
    const mk = G.makor(n);
    if (!mk) {
      $('primeMakor').innerHTML = '<span class="sub">גורם ראשוני גדול מדי לחישוב המיקום.</span>';
    } else {
      const mapping = mk.map.map(x => `${x.p}→<b>${x.idx}</b>${sup(x.k)}`).join(' · ');
      $('primeMakor').innerHTML =
        `<div class="sub math-block">${mapping}</div>
         <span class="math">${mk.map.map(x => Array(x.k).fill(x.idx).join(' × ')).join(' × ')} = <b class="r-big">${mk.value}</b></span>${findBtn(mk.value)}`;
    }

    // יסוד + מקור
    if (mk && ys != null) {
      const t = ys + mk.value;
      $('primeYM').innerHTML = `<span class="math">${ys} <span class="plus">﬩</span> ${mk.value} = <b class="r-big">${t}</b></span>${findBtn(t)}`;
    } else $('primeYM').innerHTML = '<span class="sub">—</span>';
  }

  // ---- מספרים צורניים ----
  // תבניות שורות (ממורכזות, שפיץ באמצע) לכל צורה דו-ממדית — לפי ציורי הספר
  function figRows(type, n) {
    const up = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };
    const dn = (a, b) => { const r = []; for (let i = a; i >= b; i--) r.push(i); return r; };
    switch (type) {
      case 'triangle': return up(1, n);
      case 'square':   return Array(n).fill(n);
      case 'inspire':  return n === 1 ? [1] : [...up(1, n - 1).map(i => 2 * i - 1), 2 * n - 1, ...dn(n - 1, 1).map(i => 2 * i - 1)];
      case 'yahalom':  return [...up(1, n), ...dn(n, 1)];
      case 'chava':    return [...dn(n, 1), ...up(2, n)];               // שעון-חול: דוקדוק משותף
      case 'brit':     return n === 1 ? [1] : [...dn(n - 1, 1), 1, ...up(1, n - 1)]; // + נקודה באמצע
      case 'chashmal': return [...up(1, n - 1), ...Array(n).fill(n)];   // משולש על מרובע
      case 'bayit':    return [...up(1, n), ...Array(n).fill(n)];       // גג רחב יותר
      case 'shabbat':  return [...up(n, 2 * n - 1), ...dn(2 * n - 2, n)]; // משושה ממורכז
      case 'magenDavid': {
        if (n === 1) return [1];
        return [...up(1, n - 1), ...dn(3 * n - 2, 2 * n - 1), ...up(2 * n, 3 * n - 2), ...dn(n - 1, 1)];
      }
      default: return null; // מבוקע/טטרהדרל — תלת-ממדיים
    }
  }

  // ציור SVG של צורה: נקודות בשורות ממורכזות
  function figSvg(type, n, highlightTotal) {
    const rows = figRows(type, n);
    if (!rows) return null;
    const total = rows.reduce((a, b) => a + b, 0);
    if (total > 1300) return { tooBig: true, total };
    const DX = 15, DY = 14, R = 4.6, PAD = 8;
    const maxW = Math.max(...rows);
    const w = maxW * DX + PAD * 2, h = rows.length * DY + PAD * 2;
    let dots = '';
    rows.forEach((len, ri) => {
      const y = PAD + ri * DY + DY / 2;
      const x0 = PAD + ((maxW - len) * DX) / 2 + DX / 2;
      for (let i = 0; i < len; i++) {
        dots += `<circle cx="${(x0 + i * DX).toFixed(1)}" cy="${y.toFixed(1)}" r="${R}" style="fill:var(--accent)"/>`;
      }
    });
    return { total, svg: `<svg viewBox="0 0 ${w} ${h}" width="${Math.min(w, 420)}" xmlns="http://www.w3.org/2000/svg" role="img">${dots}</svg>` };
  }

  function renderFigurate() {
    $('figValue').textContent = currentNum || 0;
    const idBox = $('figIdentify');
    idBox.innerHTML = '';
    let hits = [];
    if (currentNum) {
      hits = G.identifyFigurate(currentNum);
      if (hits.length) {
        // ציור הצורה של הערך עצמו — לא רק שם
        hits.forEach(h => {
          const wrap = el('div', 'fig-draw');
          const cap = `<div class="fig-cap"><b>${G.FIGURATE[h.type].he} ה-${h.index}</b> = ${currentNum}</div>`;
          const d = figSvg(h.type, h.index);
          wrap.innerHTML = cap + (d ? (d.tooBig ? `<span class="sub">(${d.total} נקודות — גדול מדי לציור)</span>` : d.svg)
                                    : '<span class="sub">(צורה תלת-ממדית)</span>');
          idBox.appendChild(wrap);
        });
      } else {
        idBox.appendChild(el('span', 'chip none', `${currentNum} אינו מספר צורני בסיסי`));
      }
    } else idBox.appendChild(el('span', 'chip none', '—'));

    // סנכרון המחולל לערך הנוכחי כשהוא צורני
    if (hits.length) {
      $('figType').value = hits[0].type;
      $('figN').value = hits[0].index;
    }
    renderFigGen();
  }

  function renderFigGen() {
    const type = $('figType').value;
    const n = Math.max(1, parseInt($('figN').value || '1', 10));
    const t = G.FIGURATE[type];
    const ofN = G.figurateOf(type, n);
    const series = G.figurateSeries(type, Math.max(n + 3, 10));
    const nth = G.figurateSeries(type, n)[n - 1];
    const list = series.map((x, i) => (i === n - 1) ? `<b>${x}</b>` : x).join(' ');
    $('figGen').innerHTML =
      `<div>ה${t.he} ה-<b>${n}</b> בסדרה = <b class="r-big">${nth}</b>` +
      (nth !== ofN ? ` &nbsp;·&nbsp; ה${t.he} <b>של ${n}</b> (כתיב עילי) = <b class="hl">${ofN}</b>` : '') + `</div>
      <div class="series-list">${list}</div>`;
    const d = figSvg(type, n);
    $('figDots').innerHTML = d ? (d.tooBig ? `<span class="sub">(${d.total} נקודות — גדול מדי לציור)</span>` : d.svg)
                               : `<span class="sub">צורה תלת-ממדית (${t.he}) — אין ציור שטוח</span>`;
  }

  // ---- סדרות ----
  function renderSeries() {
    const gs = G.goldenSection(currentNum || 0);
    $('goldenResult').innerHTML = currentNum
      ? `gs(${currentNum}) = ( עליון <b class="hl">${gs.upper}</b> , תחתון <b class="hl">${gs.lower}</b> )
         <div class="sub">היחס ${gs.lower}/${gs.upper} ≈ ${round(gs.lower/(gs.upper||1))} (φ≈1.618)</div>`
      : '<span class="sub">—</span>';
    const seq = currentNum ? G.additiveSeriesFor(currentNum, 20) : [];
    $('additiveResult').innerHTML = seq.length
      ? `<div class="series-list">${seq.map(x => x === currentNum ? `<b>${x}</b>` : x).join(' ')}</div>`
      : '<span class="sub">—</span>';
    renderDiff();
    $('fibResult').innerHTML = `<div class="series-list">${G.fibonacci(16).join(' ')}</div>`;
  }

  function renderDiff() {
    const nums = $('diffInput').value.split(/[,\s]+/).map(Number).filter(x => !isNaN(x));
    if (nums.length < 2) { $('diffResult').innerHTML = '<span class="sub">הזן לפחות שני מספרים.</span>'; return; }
    const tri = G.differenceTriangle(nums);
    const rows = tri.map(r => `<div class="r math">${r.join('  ')}</div>`).join('');
    const base = tri[tri.length - 1];
    $('diffResult').innerHTML = `<div class="dots">${rows}</div>
      <div class="eq-note">בסיס הסדרה: <b class="hl math">${base.join(', ')}</b></div>`;
  }

  // ---- חיפוש בתנ"ך ----
  let searchScope = 'words';
  function initSearch() {
    S.load().then(info => {
      $('searchStatus').textContent = `המאגר נטען: ${info.verses.toLocaleString('he')} פסוקים · ${info.words.toLocaleString('he')} מילים ייחודיות.`;
      runSearch();
    }).catch(() => { $('searchStatus').textContent = 'שגיאה בטעינת המאגר.'; });
  }
  function runSearch() {
    if (!S.ready) return;
    const value = parseInt($('searchValue').value || '0', 10);
    const method = $('searchMethod').value;
    const box = $('searchResults');
    box.innerHTML = '';
    if (!value) { box.innerHTML = '<span class="sub">הזן ערך.</span>'; return; }
    if (searchScope === 'words') {
      let ws = S.searchWords(value, method);
      // המילה/הביטוי שממנו חושב הערך — ראשונה ומודגשת (גם אם אינה בתנ״ך)
      const srcText = G.words(currentText).join(' ');
      const srcLetters = G.onlyLetters(currentText);
      const srcMatches = srcLetters && S.valueByMethod(srcText, method) === value;
      if (srcMatches) ws = ws.filter(w => w !== srcLetters);
      $('searchStatus').textContent = `${ws.length + (srcMatches ? 1 : 0)} מילים ${ws.length >= 400 ? '(מוצגות 400 ראשונות) ' : ''}ששוות ${value} בשיטת ${methodLabel(method)}:`;
      const wrap = el('div', ''); wrap.id = 'wordResults';
      if (srcMatches) {
        const c = el('span', 'res-word src', srcText);
        c.title = 'המילה שלך';
        c.onclick = () => showContext(srcText, c);
        wrap.appendChild(c);
      }
      ws.forEach(w => {
        const c = el('span', 'res-word', w);
        c.onclick = () => showContext(w, c);
        wrap.appendChild(c);
      });
      box.appendChild(wrap);
    } else if (searchScope === 'phrases') {
      const ps = S.searchPhrases(value, method);
      $('searchStatus').textContent = `${ps.length} צירופים ${ps.length >= 300 ? '(מוצגים 300 ראשונים) ' : ''}של 2–5 מילים עוקבות ששווים ${value} בשיטת ${methodLabel(method)}:`;
      const wrap = el('div', ''); wrap.id = 'wordResults';
      ps.forEach(pr => {
        const c = el('span', 'res-word', pr.p + (pr.count > 1 ? ` <small>×${pr.count}</small>` : ''));
        c.onclick = () => showContext(pr.p, c);
        wrap.appendChild(c);
      });
      box.appendChild(wrap);
    } else {
      const vs = S.searchVerses(value, method);
      $('searchStatus').textContent = `${vs.length} פסוקים ${vs.length >= 200 ? '(מוצגים 200 ראשונים) ' : ''}ששווים ${value} בשיטת ${methodLabel(method)}:`;
      vs.forEach(v => { box.appendChild(el('div', 'res-verse', `<div class="ref">${v.r}</div><div class="txt">${v.v || v.t}</div>`)); });
    }
  }

  // פאנל הקשר: כל ההיקרויות של מילה/צירוף, מנוקד, עם הדגשה
  function showContext(phrase, anchorEl) {
    // הסרת פאנל קודם
    const old = document.getElementById('contextPanel');
    if (old) {
      const samePhrase = old.dataset.phrase === phrase;
      old.remove();
      document.querySelectorAll('.res-word.open').forEach(x => x.classList.remove('open'));
      if (samePhrase) return; // לחיצה שנייה סוגרת
    }
    anchorEl.classList.add('open');
    const occ = S.occurrences(phrase);
    const panel = el('div', 'context-panel');
    panel.id = 'contextPanel';
    panel.dataset.phrase = phrase;
    const head = el('div', 'ctx-head',
      `<b>${phrase}</b> · ${G.hechrechi(phrase)} בהכרחי · ${occ.length} היקרויות${occ.length >= 100 ? ' (מוצגות 100)' : ''}
       <button class="chip ctx-calc">🧮 טען למחשבון</button>`);
    head.querySelector('.ctx-calc').onclick = () => { $('mainInput').value = phrase; refresh(); switchTab('values'); };
    panel.appendChild(head);
    occ.forEach(v => {
      panel.appendChild(el('div', 'res-verse',
        `<div class="ref">${v.r}</div><div class="txt">${S.highlight(v.v || v.t, phrase)}</div>`));
    });
    if (!occ.length) panel.appendChild(el('div', 'sub', 'לא נמצאו היקרויות.'));
    // מציבים את הפאנל מיד אחרי שורת הצ'יפים
    anchorEl.parentElement.after(panel);
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function methodLabel(m){return {hechrechi:'הכרחי',siduri:'סידורי',katan:'קטן',kidmi:'קדמי'}[m]||m;}

  // גישור מבחוץ (מכפתור הפירוט)
  window.GemUI = {
    searchFor(value, method) {
      $('searchValue').value = value;
      $('searchMethod').value = method;
      switchTab('search');
      if (!S.ready) initSearch(); else runSearch();
    }
  };

  // ---- טאבים ----
  function switchTab(name) {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab').forEach(t => t.hidden = (t.id !== 'tab-' + name));
    if (name === 'search') { if (!S.ready) initSearch(); else runSearch(); }
  }

  function round(x){ return Math.round(x*1000)/1000; }
  function plural(n, one, many){ return n === 1 ? one : n + ' ' + many; }
  // פורמט מספרים גדולים: מפרידי אלפים (גם למחרוזות BigInt מההכאה)
  function fmtNum(v){
    if (typeof v === 'string') return v.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return '—';                       // חלוקה באפס
      if (!Number.isInteger(v)) v = Math.round(v * 1000) / 1000;  // עיגול שברים (חילוק)
      if (Math.abs(v) >= 1000000) return v.toLocaleString('en-US');
    }
    return v;
  }

  // ---- הגדרות: ערכת צבעים + גודל טקסט ----
  const THEMES = [
    { id: 'light',        label: 'בהיר',        bg: '#f2e7cc', accent: '#9a7520' },
    { id: 'dark',         label: 'כהה',         bg: '#0d0b07', accent: '#e3bd57' },
    { id: 'neurim-light', label: 'צבעוני בהיר', bg: '#f5f2ff', accent: '#6d3bf5' },
    { id: 'neurim-dark',  label: 'צבעוני כהה',  bg: '#15131f', accent: '#ece4ff' },
    { id: 'contrast',     label: 'ניגודיות',    bg: '#000000', accent: '#ffff00' },
  ];
  const SIZES = [{ v: 0.85, label: 'קטן' }, { v: 1, label: 'רגיל' }, { v: 1.18, label: 'גדול' }, { v: 1.4, label: 'ענק' }];
  const THEME_IDS = THEMES.map(t => t.id);

  function currentTheme() { const t = localStorage.getItem('gemTheme'); return THEME_IDS.includes(t) ? t : 'dark'; }
  function currentScale() { const s = parseFloat(localStorage.getItem('gemScale')); return (s >= 0.7 && s <= 1.6) ? s : 1; }

  function setTheme(id) {
    document.documentElement.classList.remove('light', 'contrast', 'neurim-light', 'neurim-dark');
    if (id !== 'dark') document.documentElement.classList.add(id);
    localStorage.setItem('gemTheme', id);
    const th = THEMES.find(t => t.id === id);
    const mc = document.querySelector('meta[name=theme-color]'); if (mc && th) mc.content = th.bg;
    document.querySelectorAll('#themeGrid .theme-opt').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    // צביעת ציורי הצורות מחדש (משתמשים ב-currentColor דרך CSS var — יתעדכן אוטומטית)
  }
  function setScale(v) {
    document.documentElement.style.fontSize = (16 * v) + 'px';
    localStorage.setItem('gemScale', String(v));
    document.querySelectorAll('#sizeRow .size-opt').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.v) === v));
  }

  function buildSettings() {
    const grid = $('themeGrid');
    if (grid && !grid.children.length) {
      THEMES.forEach(t => {
        const b = el('button', 'theme-opt');
        b.type = 'button'; b.dataset.id = t.id;
        b.innerHTML = `<span class="sw" style="background:${t.bg};border-color:${t.accent}"></span>${t.label}`;
        b.onclick = () => setTheme(t.id);
        grid.appendChild(b);
      });
    }
    const row = $('sizeRow');
    if (row && !row.children.length) {
      SIZES.forEach(s => {
        const b = el('button', 'size-opt');
        b.type = 'button'; b.dataset.v = s.v;
        b.innerHTML = `<span class="a" style="font-size:${Math.round(16 * s.v)}px">א</span><span class="lbl">${s.label}</span>`;
        b.onclick = () => setScale(s.v);
        row.appendChild(b);
      });
    }
    // סימון הבחירה הנוכחית
    document.querySelectorAll('#themeGrid .theme-opt').forEach(b => b.classList.toggle('active', b.dataset.id === currentTheme()));
    document.querySelectorAll('#sizeRow .size-opt').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.v) === currentScale()));
  }

  function openSettings() { buildSettings(); $('settingsOverlay').hidden = false; }
  function closeSettings() { $('settingsOverlay').hidden = true; }

  // ---- באנר "מה חדש" (בשיטת לִשְׁקֹד) ------------------------------------------
  // כרטיס תחתון לא-חוסם, פעם אחת לכל גרסה. מספר הגרסה חי ב-.cl-latest של היסטוריית
  // הגרסאות — כך שהבאנר עולה רק כשבאמת נוסף תוכן חדש (ולא בכל פריסת תיקונים).
  // למשתמש חדש לא מציגים כלום (אין מה להשלים) — רק רושמים בשקט את גרסתו.
  const WN_KEY = 'gemWnVer';
  function _wnCurrentVer() {
    try { const el = document.querySelector('.changelog .cl-latest');
      const m = el && (el.textContent || '').match(/גרסה\s+([\d.]+)/); return m ? m[1] : ''; }
    catch (_) { return ''; }
  }
  // מפתח בר-השוואה: "1.0.31" → "00001.00000.00031"
  const _wnKeyOf = v => String(v).split('.').map(n => String(n).padStart(5, '0')).join('.');

  // זיהוי משתמש חוזר שאין לו עדיין גרסה שמורה (כלומר: היה כאן לפני שהמנגנון הזה הופעל).
  // בלעדיו הוא היה נחשב "חדש" ומפספס את הבאדנר על הגרסה הראשונה שבה המנגנון עלה.
  // שני סימנים: (1) מפתח הגדרות קיים; (2) הדף כבר נשלט ע"י service worker — מה שקורה רק
  // בביקור חוזר (בביקור ראשון ה-SW עוד מתקין בזמן ש-initWhatsNew רץ).
  const WN_LEGACY_KEYS = ['gemTheme', 'gemScale', 'gemFont', 'gemInstallDismissed'];
  function _wnReturningUser() {
    try {
      if (WN_LEGACY_KEYS.some(k => localStorage.getItem(k) !== null)) return true;
      if (navigator.serviceWorker && navigator.serviceWorker.controller) return true;
      return false;
    } catch (_) { return false; }
  }

  function wnOpenHistory() {
    try {
      openSettings();
      setTimeout(() => {
        const d = document.querySelector('#settingsOverlay .changelog');
        if (!d) return;
        d.open = true;
        (d.querySelector('summary') || d).scrollIntoView({ block: 'center', behavior: 'auto' });
      }, 140);
    } catch (_) {}
  }

  function initWhatsNew() {
    try {
      const cur = _wnCurrentVer(); if (!cur) return;
      const seen = localStorage.getItem(WN_KEY) || '';
      // משתמש חדש לגמרי → רישום שקט, אין מה להשלים. משתמש חוזר בלי גרסה שמורה → כן מציגים.
      if (!seen && !_wnReturningUser()) { localStorage.setItem(WN_KEY, cur); return; }
      if (seen && _wnKeyOf(seen) >= _wnKeyOf(cur)) return;             // כבר מעודכן
      // הצצה = פריטי הגרסה החדשה ביותר (הרשימה המלאה במרחק לחיצה)
      const ver = document.querySelector('.changelog .cl-ver');
      const items = ver ? [...ver.querySelectorAll('.cl-list li')].map(li => (li.textContent || '').trim()).filter(Boolean) : [];
      if (!items.length) { localStorage.setItem(WN_KEY, cur); return; }
      setTimeout(() => { if (!document.getElementById('whatsnew-banner')) _wnBuild(items, cur); }, 1200);
    } catch (_) {}
  }

  function _wnBuild(items, cur) {
    try {
      const seal = () => { try { localStorage.setItem(WN_KEY, cur); } catch (_) {} };
      const wrap = el('div'); wrap.id = 'whatsnew-banner';
      const card = el('div', 'wn-card');
      const head = el('div', 'wn-head');
      const title = el('span', 'wn-title'); title.textContent = '🎁 מה חדש בגימטריא';
      const x = el('button', 'wn-x'); x.setAttribute('aria-label', 'סגירה'); x.textContent = '✕';
      head.appendChild(title); head.appendChild(x);
      const body = el('div', 'wn-body');
      const ul = el('ul', 'wn-list');
      items.slice(0, 3).forEach(t => { const li = el('li'); li.textContent = t; ul.appendChild(li); });
      body.appendChild(ul);
      const actions = el('div', 'wn-actions');
      const go = el('button', 'wn-go'); go.textContent = 'כל מה שחדש ›';
      const ok = el('button', 'wn-ok'); ok.textContent = 'הבנתי';
      actions.appendChild(go); actions.appendChild(ok);
      card.appendChild(head); card.appendChild(body); card.appendChild(actions);
      wrap.appendChild(card); document.body.appendChild(wrap);
      const dismiss = () => { seal(); wrap.classList.add('wn-out'); setTimeout(() => { try { wrap.remove(); } catch (_) {} }, 300); };
      x.addEventListener('click', dismiss);
      ok.addEventListener('click', dismiss);
      go.addEventListener('click', () => { dismiss(); wnOpenHistory(); });
    } catch (_) {}
  }

  // ---- אתחול ----
  function init() {
    // מספר גרסה במסך ההגדרות
    if ($('appVersion')) $('appVersion').textContent = APP_VERSION;

    // מילוי בורר סוגי צורניים
    const sel = $('figType');
    Object.keys(G.FIGURATE).forEach(k => { const o = el('option', '', G.FIGURATE[k].he); o.value = k; sel.appendChild(o); });

    // הגדרות
    if ($('settingsBtn')) $('settingsBtn').onclick = openSettings;
    if ($('settingsClose')) $('settingsClose').onclick = closeSettings;
    if ($('settingsOverlay')) $('settingsOverlay').addEventListener('click', e => { if (e.target === $('settingsOverlay')) closeSettings(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('settingsOverlay') && !$('settingsOverlay').hidden) closeSettings(); });

    $('mainInput').addEventListener('input', () => { heifyPlus($('mainInput')); refresh(); });
    if ($('clearInput')) $('clearInput').addEventListener('click', () => { $('mainInput').value = ''; refresh(); $('mainInput').focus(); });
    $('opA').addEventListener('input', renderHakaahPratit);
    $('opB').addEventListener('input', renderHakaahPratit);
    $('figType').addEventListener('change', renderFigGen);
    $('figN').addEventListener('input', renderFigGen);
    $('diffInput').addEventListener('input', renderDiff);
    $('searchValue').addEventListener('input', runSearch);
    $('searchMethod').addEventListener('change', runSearch);

    document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { switchTab(b.dataset.tab); history.replaceState(null,'','#'+b.dataset.tab); });
    document.querySelectorAll('.scope-toggle button').forEach(b => b.onclick = () => {
      searchScope = b.dataset.scope;
      document.querySelectorAll('.scope-toggle button').forEach(x => x.classList.toggle('active', x === b));
      runSearch();
    });

    // דיפ-לינק: ?q=טקסט  ו-#tab
    const params = new URLSearchParams(location.search);
    if (params.get('q')) $('mainInput').value = params.get('q');
    refresh();
    if (params.get('v')) $('searchValue').value = params.get('v'); // אחרי refresh, שלא יידרס
    loadValuesList();
    const sc = params.get('s');
    if (['words','phrases','verses'].includes(sc)) {
      searchScope = sc;
      document.querySelectorAll('.scope-toggle button').forEach(x => x.classList.toggle('active', x.dataset.scope === sc));
    }
    const tab = (location.hash || '').replace('#', '');
    if (['values','ops','primes','figurate','series','search'].includes(tab)) switchTab(tab);
    initWhatsNew();   // באנר "מה חדש" — פעם אחת לכל גרסה (לא למשתמש חדש)
  }
  document.addEventListener('DOMContentLoaded', init);
})();
