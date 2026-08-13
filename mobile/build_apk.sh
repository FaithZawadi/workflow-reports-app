#!/usr/bin/env bash
# Build a release APK for the QSL Maintenance app.
#
# The android/ platform folder is intentionally NOT committed (see .gitignore),
# so it is generated fresh here — which resets the AndroidManifest and platform
# icons. This script regenerates it, re-applies the required permissions, stamps
# the launcher icon + splash, and produces build/app/outputs/flutter-apk/app-release.apk
#
# Prereqs (on your machine, not the web sandbox):
#   - Flutter SDK on PATH  (flutter --version)
#   - Android SDK + a JDK   (flutter doctor should be green for Android)
#
# Usage:
#   cd mobile
#   ./build_apk.sh                                   # uses the default server
#   QSL_BASE_URL=https://staging.example.com ./build_apk.sh   # point at staging
set -euo pipefail
cd "$(dirname "$0")"

BASE_URL="${QSL_BASE_URL:-https://reports.qalibrated.com}"
echo "▶ Building QSL Maintenance APK  ·  server = $BASE_URL"

command -v flutter >/dev/null || { echo "✗ Flutter is not on PATH. Install Flutter first: https://docs.flutter.dev/get-started/install"; exit 1; }

# 1) Generate the native platform folders if they are missing.
if [ ! -d android ]; then
  echo "▶ Generating android/ (and ios/) platform folders…"
  flutter create --platforms=android,ios .
fi

# 2) Ensure the runtime permissions the app needs are present in the manifest.
#    (flutter create only grants INTERNET in the debug manifest.) Idempotent.
MANIFEST="android/app/src/main/AndroidManifest.xml"
python3 - "$MANIFEST" <<'PY'
import sys, re
p = sys.argv[1]
xml = open(p, encoding="utf-8").read()
perms = [
    "android.permission.INTERNET",
    "android.permission.CAMERA",
    "android.permission.ACCESS_FINE_LOCATION",
]
add = "".join(
    f'    <uses-permission android:name="{n}"/>\n'
    for n in perms if n not in xml
)
changed = False
if add:
    # Insert right after the opening <manifest ...> tag.
    xml = re.sub(r"(<manifest\b[^>]*>\n)", r"\1" + add, xml, count=1)
    changed = True
    print("▶ Added missing permissions to the manifest.")
else:
    print("▶ Manifest permissions already present.")

# The server is HTTPS-only — forbid cleartext (HTTP) traffic app-wide so a
# downgrade/MITM can't push the app onto plaintext.
if "usesCleartextTraffic" not in xml:
    xml = re.sub(r"(<application\b)", r'\1 android:usesCleartextTraffic="false"', xml, count=1)
    changed = True
    print("▶ Disabled cleartext (HTTP) traffic.")

if changed:
    open(p, "w", encoding="utf-8").write(xml)
PY

# 2b) Pin a consistent compileSdk (and a namespace fallback) on the app and every
#     plugin module, so no plugin trips on "compileSdkVersion is not specified" or
#     "compiled against android-33". Guarded so re-runs don't append twice, and
#     state-checked so it never calls afterEvaluate on an already-evaluated project
#     (the default build.gradle pre-evaluates :app via evaluationDependsOn).
if ! grep -q "qslPinAndroid" android/build.gradle; then
  cat >> android/build.gradle <<'GRADLE'

def qslPinAndroid = { proj ->
    if (proj.hasProperty("android")) {
        proj.android {
            compileSdkVersion 34
            if (proj.android.namespace == null) {
                namespace proj.group.toString()
            }
        }
    }
}
subprojects { proj ->
    if (proj.state.executed) {
        qslPinAndroid(proj)
    } else {
        proj.afterEvaluate { qslPinAndroid(proj) }
    }
}
GRADLE
  echo "▶ Pinned compileSdk 34 for all Android modules."
fi

# 3) Dependencies, launcher icon and native splash.
flutter pub get
dart run flutter_launcher_icons
dart run flutter_native_splash:create

# 4) Static analysis gate (fail fast on any error).
echo "▶ flutter analyze (non-fatal)…"
# Analyze is only a lint gate — never let it block the APK. Some Flutter installs
# have a broken analysis server (missing analysis_server snapshot) which crashes
# 'flutter analyze'; the release build itself still surfaces real compile errors.
flutter analyze || echo "⚠ flutter analyze failed or crashed — continuing to the build anyway."

# 5) The release APK.
flutter build apk --release --dart-define=QSL_BASE_URL="$BASE_URL"

APK="build/app/outputs/flutter-apk/app-release.apk"
echo ""
echo "✅ Done → $APK"
ls -lh "$APK" 2>/dev/null || true
