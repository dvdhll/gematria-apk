// מריצים אחרי `npx cap add android` ב-CI. תיקיית android/ מיוצרת מחדש בכל בנייה
// (היא ב-gitignore), לכן את מספר-הגרסה ואת תצורת החתימה מזריקים כאן ל-build.gradle המיוצר.
// versionCode חייב לעלות בכל העלאה ל-Play → github.run_number.
// versionName = גרסת האנדרואיד מ-package.json (נפרדת מגרסת התוכן של האתר).
import fs from 'fs';

const GRADLE = 'android/app/build.gradle';
let s = fs.readFileSync(GRADLE, 'utf8');

// --- versionCode / versionName ---
const versionCode = process.env.VERSION_CODE || '1';
let versionName = process.env.VERSION_NAME || '';
if (!versionName) {
  // מספור עצמאי לאנדרואיד, מ-package.json. במכוון *לא* נגזר מגרסת התוכן של האתר:
  // גרסת האתר וגרסת האפליקציה נפרדות ומתפצלות (החלטת דוד, 2026-09-16).
  try { versionName = JSON.parse(fs.readFileSync('package.json', 'utf8')).version || ''; } catch {}
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

// להחיל את החתימה על buildType release בלבד — עוגן על minifyEnabled שקיים רק שם
// (ולא על ה-release שבתוך signingConfigs).
if (!/signingConfig\s+signingConfigs\.release/.test(s)) {
  s = s.replace(/(minifyEnabled\s+\w+)/, `signingConfig signingConfigs.release
            $1`);
}

fs.writeFileSync(GRADLE, s);
console.log(`patched ${GRADLE}: versionCode=${versionCode} versionName=${versionName}`);
console.log('----- build.gradle -----');
console.log(s);
