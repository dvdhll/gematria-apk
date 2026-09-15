// מריצים אחרי `npx cap add android` ב-CI. תיקיית android/ מיוצרת מחדש בכל בנייה
// (היא ב-gitignore), לכן את מספר-הגרסה ואת תצורת החתימה מזריקים כאן ל-build.gradle המיוצר.
// versionCode חייב לעלות בכל העלאה ל-Play → github.run_number. versionName נגזר מגרסת
// התוכן של האתר (www/index.html) כדי שלא יישאר מאחור (ראה לקח "לא להשאיר תוויות ישנות").
import fs from 'fs';

const GRADLE = 'android/app/build.gradle';
let s = fs.readFileSync(GRADLE, 'utf8');

// --- versionCode / versionName ---
const versionCode = process.env.VERSION_CODE || '1';
let versionName = process.env.VERSION_NAME || '';
if (!versionName) {
  try {
    const html = fs.readFileSync('www/index.html', 'utf8');
    const m = html.match(/גרסה\s+(\d+\.\d+\.\d+)/);
    if (m) versionName = m[1];
  } catch {}
}
versionName = versionName || '1.0.0';

s = s.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
s = s.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

// --- signingConfigs.release (חתימת ה-AAB וה-APK ע"י gradle) ---
if (!/signingConfigs\s*\{/.test(s)) {
  s = s.replace(/(\n\s*)buildTypes\s*\{/, `$1signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_FILE"))
            storeType "PKCS12"
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD") ?: System.getenv("KEYSTORE_PASSWORD")
        }
    }$1buildTypes {`);
}

// להחיל את החתימה על buildType release (מזריקים אחרי '{' של release)
if (!/signingConfig\s+signingConfigs\.release/.test(s)) {
  s = s.replace(/(release\s*\{)/, `$1
            signingConfig signingConfigs.release`);
}

fs.writeFileSync(GRADLE, s);
console.log(`patched ${GRADLE}: versionCode=${versionCode} versionName=${versionName}`);
console.log('----- build.gradle -----');
console.log(s);
