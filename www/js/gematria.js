/*
 * gematria.js — מנוע חישובי גימטריא
 * מבוסס על "מבוא לגימטריא" מתוך הספר "עיניך ברכות בחשבון".
 * טהור, ללא תלות. עובד בדפדפן (window.Gem) וב-Node (module.exports).
 *
 * מוסכמות:
 *  - "הכרחי" = ערך רגיל/סטנדרטי.
 *  - אותיות סופיות: כברירת מחדל מקבלות את ערך האות הפשוטה (נ=ן=50).
 *    במצב "גדול" (opts.sofit=true / שיטת "גדול") מקבלות 500–900.
 */
(function (root) {
  'use strict';

  // ---- טבלאות בסיס ----------------------------------------------------------
  // ערך הכרחי של האותיות הפשוטות
  const BASE = {
    א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
    י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90,
    ק: 100, ר: 200, ש: 300, ת: 400,
  };
  // מיפוי סופית -> פשוטה
  const FINAL_TO_BASE = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
  // ערך "גדול" של הסופיות (500–900)
  const FINAL_GADOL = { ך: 500, ם: 600, ן: 700, ף: 800, ץ: 900 };

  // סדר האלף-בית לצורך "סידורי" ו"קדמי" (27 אותיות כולל סופיות, כפי שבטבלת המקור)
  const ORDER = ['א','ב','ג','ד','ה','ו','ז','ח','ט','י','כ','ל','מ','נ','ס','ע','פ','צ','ק','ר','ש','ת','ך','ם','ן','ף','ץ'];

  // בונים לכל אות: הכרחי / סידורי / קטן / קדמי
  const LETTER = {}; // letter -> {hechrechi, siduri, katan, kidmi}
  (function build() {
    // ערך הכרחי לכל אות (כולל סופיות בערכן הגדול, כמו בטבלת המקור)
    const abs = {};
    for (const k in BASE) abs[k] = BASE[k];
    for (const k in FINAL_GADOL) abs[k] = FINAL_GADOL[k];

    let cum = 0;
    ORDER.forEach((ltr, i) => {
      cum += abs[ltr];
      LETTER[ltr] = {
        hechrechi: abs[ltr],
        siduri: i + 1,              // 1..27
        katan: digitalRoot(abs[ltr]),
        kidmi: cum,                 // סכום מצטבר של ההכרחי
      };
    });
  })();

  // ---- עזרי מספרים ----------------------------------------------------------
  function digitSum(n) {
    n = Math.abs(n);
    let s = 0;
    while (n > 0) { s += n % 10; n = Math.floor(n / 10); }
    return s;
  }
  // שורש דיגיטלי (מצמצם עד ספרה בודדת 1..9); 0 -> 0
  function digitalRoot(n) {
    n = Math.abs(n);
    if (n === 0) return 0;
    const r = n % 9;
    return r === 0 ? 9 : r;
  }

  // ---- ניקוי טקסט -----------------------------------------------------------
  // סימוני מקרא: החישוב לפי ה"כתיב" בלבד.
  //  • כתיב  (בסוגריים עגולים)  — נכלל בחישוב, מסירים רק את הסוגריים.
  //  • קרי   [בסוגריים מרובעים] — מושמט לגמרי.
  //  • מסורה *(בעיגול עם אסטריסק) — מושמטת (כמו בלשקוד; שונה מכתיב שאין לפניו אסטריסק).
  //  • סימני פרשה פתוחה/סתומה/שירה {פ}/{ס}/{ש} (בסוגריים מסולסלים) — מושמטים.
  function stripNotation(str) {
    return String(str)
      .replace(/\[[^\]]*\]/g, ' ')       // קרי — הסרה
      .replace(/\*\s*\([^)]*\)/g, ' ')    // מסורה *(…) — הסרה (אסטריסק + עגולים)
      .replace(/\{[^}]*\}/g, ' ')        // סימני פרשה — הסרה
      .replace(/[()]/g, '');              // כתיב (…) — הסרת הסוגריים בלבד, שמירת התוכן
  }
  // משאיר רק אותיות עבריות; מסיר סימוני מקרא, ניקוד, טעמים, פיסוק, ספרות.
  function onlyLetters(str) {
    if (!str) return '';
    return stripNotation(String(str))
      .replace(/[֑-ׇ]/g, '')          // ניקוד וטעמים
      .replace(/[^א-ת]/g, '');          // רק א..ת + סופיות
  }
  function words(str) {
    if (!str) return [];
    return stripNotation(String(str))
      .replace(/[֑-ׇ]/g, '')
      .split(/[^א-ת]+/)
      .filter(Boolean);
  }

  // מחזיר את ערך האות לפי שיטה; מטפל בסופיות
  function letterValue(ltr, field, sofit) {
    let L = LETTER[ltr];
    if (!L) {
      // אולי אות סופית שצריך לקפל לפשוטה
      return 0;
    }
    if (FINAL_TO_BASE[ltr] && !sofit) {
      // מצב רגיל: סופית = ערך האות הפשוטה
      const base = FINAL_TO_BASE[ltr];
      if (field === 'hechrechi') return LETTER[base].hechrechi;
      if (field === 'katan') return LETTER[base].katan;
      if (field === 'siduri') return LETTER[base].siduri;
      if (field === 'kidmi') return LETTER[base].kidmi;
    }
    return L[field];
  }

  // ---- שיטות ברמת המילה/הביטוי ---------------------------------------------
  function sumBy(text, field, sofit) {
    const s = onlyLetters(text);
    let total = 0;
    for (const ch of s) total += letterValue(ch, field, sofit) || 0;
    return total;
  }

  const hechrechi = (t, opts = {}) => sumBy(t, 'hechrechi', opts.sofit);
  const siduri    = (t) => sumBy(t, 'siduri');
  const katan     = (t) => sumBy(t, 'katan');
  const kidmi     = (t) => sumBy(t, 'kidmi');

  // מספר קטן מספרי: כל *מילה* מצומצמת לשורש דיגיטלי, ואז סכום המילים
  function katanMispari(text) {
    return words(text).reduce((acc, w) => acc + digitalRoot(hechrechi(w)), 0);
  }
  // מספר קטן מספרי אחרון: צמצום כל הביטוי לספרה בודדת
  function katanMispariAcharon(text) {
    return digitalRoot(hechrechi(text));
  }
  // מספר קטן מספרי שני: פיצול לשני חצאים (ידני/אתנחתא) וצמצום כל חצי
  // splitIndex = מספר המילים בחצי הראשון; אם לא ניתן, מפצל באמצע.
  function katanMispariSheni(text, splitIndex) {
    const ws = words(text);
    if (ws.length < 2) return { total: katanMispari(text), halves: [katanMispari(text)] };
    const k = splitIndex && splitIndex > 0 && splitIndex < ws.length
      ? splitIndex : Math.floor(ws.length / 2);
    const first = ws.slice(0, k).join(' ');
    const second = ws.slice(k).join(' ');
    const h1 = digitalRoot(katanMispari(first));
    const h2 = digitalRoot(katanMispari(second));
    return { total: h1 + h2, halves: [h1, h2], split: k };
  }

  // עם הכולל / מוסף: הערך + מספר האותיות (וריאנט +1)
  function letterCount(text) { return onlyLetters(text).length; }
  function wordCount(text) { return words(text).length; }
  const imHakolel = (t, opts = {}) => hechrechi(t) + 1;                 // +כולל (המילה עצמה)
  const mosaf     = (t, opts = {}) => hechrechi(t) + letterCount(t);    // +מספר האותיות

  // מרובע כללי: הערך ההכרחי בריבוע
  const merubaKlali = (t) => Math.pow(hechrechi(t), 2);
  // מרובע פרטי: סכום ריבועי כל אות
  function merubaPrati(text) {
    const s = onlyLetters(text);
    let total = 0;
    for (const ch of s) { const v = letterValue(ch, 'hechrechi'); total += v * v; }
    return total;
  }

  // ---- מילוי (שמי) ----------------------------------------------------------
  // טבלת מילוי ברירת-מחדל (ניתן להרחיב לווריאנטים).
  const MILUI = {
    א: 'אלף', ב: 'בית', ג: 'גימל', ד: 'דלת', ה: 'הא', ו: 'וו', ז: 'זין',
    ח: 'חית', ט: 'טית', י: 'יוד', כ: 'כף', ל: 'למד', מ: 'מם', נ: 'נון',
    ס: 'סמך', ע: 'עין', פ: 'פה', צ: 'צדי', ק: 'קוף', ר: 'ריש', ש: 'שין', ת: 'תו',
  };
  function milui(text) {
    const s = onlyLetters(text);
    let total = 0;
    for (const ch of s) {
      const base = FINAL_TO_BASE[ch] || ch;
      const name = MILUI[base];
      if (name) total += hechrechi(name);
    }
    return total;
  }

  // ---- פעולות "הכפל" --------------------------------------------------------
  // הכאה: מכפלת כל האותיות של מילה (BigInt — מכפלות של פסוקים חורגות מדיוק Number;
  // מוחזר Number כשבטוח, אחרת מחרוזת ספרות מדויקת)
  function hakaah(text) {
    const s = onlyLetters(text);
    if (!s) return 0;
    let prod = 1n;
    for (const ch of s) prod *= BigInt(letterValue(ch, 'hechrechi'));
    return prod <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(prod) : prod.toString();
  }
  // הכאה פרטית: מכפלה סקלרית — אות מול אות, לשתי מילים באותו אורך
  function hakaahPratit(a, b) {
    const s1 = onlyLetters(a), s2 = onlyLetters(b);
    if (s1.length !== s2.length) {
      return { error: 'שתי המילים חייבות להיות באותו מספר אותיות', len1: s1.length, len2: s2.length };
    }
    let total = 0;
    const parts = [];
    for (let i = 0; i < s1.length; i++) {
      const v1 = letterValue(s1[i], 'hechrechi');
      const v2 = letterValue(s2[i], 'hechrechi');
      total += v1 * v2;
      parts.push({ a: s1[i], b: s2[i], v1, v2, prod: v1 * v2 });
    }
    return { total, parts };
  }

  // ---- ממוצע / כנפיים ------------------------------------------------------
  // ממוצע לפי אותיות או לפי מילים
  function memutza(text, by) {
    const val = hechrechi(text);
    const n = by === 'words' ? wordCount(text) : letterCount(text);
    if (!n) return { value: 0, avg: 0, count: 0 };
    return { value: val, count: n, avg: val / n, integer: val % n === 0 };
  }
  // כנפיים: בהינתן ממוצע m ומספר איברים 2, האיברים הם m+k, m-k
  function wings(avg, k) {
    return { low: avg - k, high: avg + k, avg, k };
  }

  // ---- נקודה אמצעית / שלם וחצי ---------------------------------------------
  function midpoint(n) {
    if (n % 2 === 1) {
      // אי-זוגי: הנקודה האמצעית
      return { type: 'odd', n, middle: (n + 1) / 2 };
    }
    // זוגי: "שלם וחצי" — היחס לחצי
    return { type: 'even', n, half: n / 2, ratio: 'שלם וחצי' };
  }

  // ---- מספרים צורניים -------------------------------------------------------
  // לכל סוג שתי נוסחאות (כמפורש בעמ' לג-לד):
  //   f  = מחוללת הסדרה המודפסת ("הצורני ה-n-י", subscript)
  //   of = "הצורני *של* n" (הנוסחה מלוח הסיכום, superscript)
  // עבור טיפוסים ממורכזים (ברית/שבת/מגן-דוד) השניים נבדלים באינדקס אחד.
  const T = n => n * (n + 1) / 2; // משולש עזר
  const FIGURATE = {
    triangle:  { he: 'משולש',   f: n => T(n),                 of: n => T(n) },
    square:    { he: 'מרובע',   f: n => n * n,                of: n => n * n },
    inspire:   { he: 'השראה',   f: n => n*n + (n-1)*(n-1),    of: n => n*n + (n-1)*(n-1) }, // מרובע ממורכז
    yahalom:   { he: 'יהלם',    f: n => n * (n + 1),          of: n => n * (n + 1) },
    chava:     { he: 'חוה',     f: n => n * (n + 1) - 1,      of: n => n * (n + 1) - 1 },
    brit:      { he: 'ברית',    f: n => n*n - n + 1,          of: n => 2 * T(n) + 1 },     // ה-n: n²−n+1 ; של n: 2△n+1
    chashmal:  { he: 'חשמל',    f: n => n * (3*n - 1) / 2,    of: n => T(n-1) + n*n },     // מחומש
    bayit:     { he: 'בית',     f: n => n * (3*n + 1) / 2,    of: n => T(n) + n*n },
    shabbat:   { he: 'שבת',     f: n => 3*n*n - 3*n + 1,      of: n => 6 * T(n) + 1 },     // משושה ממורכז
    magenDavid:{ he: 'מגן דוד', f: n => 6*n*n - 6*n + 1,      of: n => 12 * T(n) + 1 },    // מספר כוכב
    cube:      { he: 'מבוקע',   f: n => n * n * n,            of: n => n * n * n },
    tetra:     { he: 'טטרהדרל', f: n => n*(n+1)*(n+2)/6,      of: n => n*(n+1)*(n+2)/6 },
  };

  // מייצר את n האיברים הראשונים של הסדרה המודפסת (ה-n-י)
  function figurateSeries(type, count) {
    const t = FIGURATE[type];
    if (!t) return [];
    const out = [];
    for (let i = 1; i <= count; i++) out.push(t.f(i));
    return out;
  }
  // הערך של הצורני *של* n (superscript)
  function figurateOf(type, n) {
    const t = FIGURATE[type];
    return t ? t.of(n) : null;
  }
  // מזהה: לאילו סוגים צורניים המספר שייך, ובאיזה אינדקס
  function identifyFigurate(value) {
    const hits = [];
    for (const key in FIGURATE) {
      const t = FIGURATE[key];
      // חיפוש אינדקס n כך ש- f(n)=value (עד גבול סביר)
      for (let n = 1; ; n++) {
        const v = t.f(n);
        if (v === value) { hits.push({ type: key, he: t.he, index: n }); break; }
        if (v > value || n > 100000) break;
      }
    }
    return hits;
  }

  // ---- סדרות חיבוריות / חתך זהב --------------------------------------------
  const PHI = (1 + Math.sqrt(5)) / 2;
  // חתך הזהב של מספר: החלק התחתון (הגדול) והעליון (הקטן)
  function goldenSection(n) {
    const lower = Math.round(n / PHI);   // ~0.618n
    const upper = n - lower;             // ~0.382n
    return { n, lower, upper };          // gs(1000) ≈ (618, 382)
  }
  // משחזר סדרה חיבורית שמכילה n לפי חתך הזהב, קדימה ואחורה
  function additiveSeriesFor(n, back) {
    const gs = goldenSection(n);
    // שני האיברים הקודמים ל-n הם upper ו-lower (upper+lower=n)
    let a = gs.upper, b = gs.lower;      // a<b, a+b=n
    const seq = [a, b, n];
    // אחורה — עוצרים כשהסדרה מפסיקה לרדת (התחלה טבעית) או שלילית
    for (let i = 0; i < (back || 8); i++) {
      const prev = b - a; // כי a_prev + a = b
      if (prev < 0 || prev >= a) break;
      seq.unshift(prev);
      b = a; a = prev;
    }
    return seq;
  }
  // סדרת פיבונאצ'י ("מספרי אהבה")
  function fibonacci(count) {
    const out = [1, 1];
    while (out.length < count) out.push(out[out.length - 1] + out[out.length - 2]);
    return out.slice(0, count);
  }

  // ---- שיטת ההפרשים (finite differences) -----------------------------------
  // בהינתן איברי סדרה, בונה את משולש ההפרשים ומחזיר את בסיס הסדרה
  function differenceTriangle(series) {
    const rows = [series.slice()];
    let cur = series.slice();
    while (cur.length > 1) {
      const next = [];
      for (let i = 0; i < cur.length - 1; i++) next.push(cur[i + 1] - cur[i]);
      rows.push(next);
      cur = next;
    }
    return rows; // rows[rows.length-1] הוא "בסיס הסדרה"
  }

  // ---- ראשוניים: פירוק, מחלקים, יסוד ומקור -----------------------------------
  // פירוק לגורמים ראשוניים: מחזיר [{p, k}]
  function factorize(n) {
    n = Math.floor(Math.abs(n));
    if (n < 2) return [];
    const out = [];
    for (let d = 2; d * d <= n; d += (d === 2 ? 1 : 2)) {
      if (n % d === 0) {
        let k = 0;
        while (n % d === 0) { n /= d; k++; }
        out.push({ p: d, k });
      }
    }
    if (n > 1) out.push({ p: n, k: 1 });
    return out;
  }
  function isPrimeNum(n) {
    const f = factorize(n);
    return f.length === 1 && f[0].k === 1;
  }
  // כל המחלקים + סכומם
  function divisorsOf(n) {
    const f = factorize(n);
    if (!f.length) return { list: n === 1 ? [1] : [], sum: n === 1 ? 1 : 0 };
    let list = [1];
    for (const { p, k } of f) {
      const cur = [];
      let pw = 1;
      for (let i = 0; i <= k; i++) { for (const d of list) cur.push(d * pw); pw *= p; }
      list = cur;
    }
    list.sort((a, b) => a - b);
    return { list, sum: list.reduce((a, b) => a + b, 0) };
  }
  // מיקום ראשוני בסדרה *כשמונים את 1 כאיבר הראשון*: 1→1, 2→2, 3→3, 5→4, 7→5, 11→6…
  // (המוסכמה בספר: index(p) = 1 + מספר הראשוניים עד p)
  const PRIME_INDEX_LIMIT = 10000000; // מעבר לזה לא מחשבים (סינון זיכרון)
  function primeIndex(p) {
    if (p === 1) return 1;
    if (!isPrimeNum(p) || p > PRIME_INDEX_LIMIT) return null;
    // ספירת ראשוניים עד p (נפה פשוטה)
    const sieve = new Uint8Array(p + 1);
    let count = 0;
    for (let i = 2; i <= p; i++) {
      if (!sieve[i]) {
        count++;
        if (i * i <= p) for (let j = i * i; j <= p; j += i) sieve[j] = 1;
      }
    }
    return count + 1; // +1 עבור 1 שנספר ראשון
  }
  // יסוד המספר: סכום המרכיבים הראשוניים (ללא 1), עם כפילויות (8=2·2·2 → 6)
  function yesod(n) {
    const f = factorize(n);
    if (!f.length) return null;
    return f.reduce((a, { p, k }) => a + p * k, 0);
  }
  // מקור המספר: מכפלת מיקומי הגורמים הראשוניים בסדרה (החל מ-1), עם כפילויות
  function makor(n) {
    const f = factorize(n);
    if (!f.length) return n === 1 ? 1 : null;
    let prod = 1;
    const map = [];
    for (const { p, k } of f) {
      const idx = primeIndex(p);
      if (idx == null) return null;
      map.push({ p, k, idx });
      prod *= Math.pow(idx, k);
    }
    return { value: prod, map };
  }

  // ---- ריכוז כל השיטות לביטוי אחד ------------------------------------------
  function analyze(text) {
    const t = onlyLetters(text);
    return {
      input: text,
      letters: t,
      letterCount: letterCount(text),
      wordCount: wordCount(text),
      hechrechi: hechrechi(text),
      gadol: hechrechi(text, { sofit: true }),
      siduri: siduri(text),
      katan: katan(text),
      kidmi: kidmi(text),
      katanMispari: katanMispari(text),
      katanMispariAcharon: katanMispariAcharon(text),
      imHakolel: imHakolel(text),
      mosaf: mosaf(text),
      merubaKlali: merubaKlali(text),
      merubaPrati: merubaPrati(text),
      milui: milui(text),
      hakaah: hakaah(text),
      figurate: identifyFigurate(hechrechi(text)),
    };
  }

  // ---- ביטויי חשבון: חיבור/חיסור/כפל/חילוק בין מילים או מספרים ----------------
  const OP_MAP = { '＋':'+','﬩':'+','➕':'+','−':'-','–':'-','—':'-','‒':'-','×':'*','✕':'*','✖':'*','∙':'*','∗':'*','÷':'/','∕':'/','⁄':'/' };
  function normalizeOps(str){ return String(str).replace(/[＋﬩➕−–—‒×✕✖∙∗÷∕⁄]/g, c => OP_MAP[c] || c); }

  // מנתח קלט לביטוי חשבוני. מחזיר {isExpr:true, tokens} או {isExpr:false}.
  // אופרנד = מספר או רצף אותיות עבריות (מילה/צירוף). אופרטורים: + - * /  (קדימות כפל/חילוק).
  function parseExpr(input){
    if (input == null) return { isExpr:false };
    const s = normalizeOps(input).trim();
    if (!s || !/[+\-*/]/.test(s.slice(1))) return { isExpr:false };   // חייב אופרטור לא-מוביל
    const parts = s.split(/([+\-*/])/);
    const tokens = [];
    let expectOperand = true;
    for (const raw of parts){
      const t = raw.trim();
      if (t === '') continue;
      if (/^[+\-*/]$/.test(t)){
        if (expectOperand) return { isExpr:false };
        tokens.push({ type:'op', op:t });
        expectOperand = true;
      } else {
        if (!expectOperand) return { isExpr:false };
        if (/^\d+(?:\.\d+)?$/.test(t)) tokens.push({ type:'num', text:t, num:parseFloat(t) });
        else if (onlyLetters(t)) tokens.push({ type:'word', text:t });
        else return { isExpr:false };
        expectOperand = false;
      }
    }
    if (expectOperand) return { isExpr:false };                       // מסתיים באופרטור
    if (!tokens.some(x => x.type === 'op')) return { isExpr:false };
    return { isExpr:true, tokens };
  }

  // מעריך ביטוי: valueFn(word)->מספר לכל אופרנד-מילה; מספרים כמו שהם. קדימות כפל/חילוק.
  function evalExprWith(tokens, valueFn){
    const vals = [], ops = [];
    for (const t of tokens){
      if (t.type === 'op') ops.push(t.op);
      else vals.push(t.type === 'num' ? t.num : (valueFn(t.text) || 0));
    }
    const v = [vals[0]], o = [];               // מעבר ראשון: כפל/חילוק
    for (let i = 0; i < ops.length; i++){
      if (ops[i] === '*') v[v.length-1] *= vals[i+1];
      else if (ops[i] === '/') v[v.length-1] /= vals[i+1];
      else { o.push(ops[i]); v.push(vals[i+1]); }
    }
    let acc = v[0];                            // מעבר שני: חיבור/חיסור
    for (let i = 0; i < o.length; i++) acc = o[i] === '+' ? acc + v[i+1] : acc - v[i+1];
    return acc;
  }

  // ---- ייצוא ----------------------------------------------------------------
  const API = {
    LETTER, BASE, FINAL_GADOL, FINAL_TO_BASE, ORDER, MILUI, FIGURATE, PHI,
    onlyLetters, words, stripNotation, letterValue, digitalRoot, digitSum, letterCount, wordCount,
    hechrechi, siduri, katan, kidmi,
    katanMispari, katanMispariAcharon, katanMispariSheni,
    imHakolel, mosaf, merubaKlali, merubaPrati, milui,
    hakaah, hakaahPratit,
    memutza, wings, midpoint,
    figurateSeries, figurateOf, identifyFigurate,
    goldenSection, additiveSeriesFor, fibonacci, differenceTriangle,
    factorize, isPrimeNum, divisorsOf, primeIndex, yesod, makor,
    normalizeOps, parseExpr, evalExprWith,
    analyze,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.Gem = API;
})(typeof window !== 'undefined' ? window : globalThis);
