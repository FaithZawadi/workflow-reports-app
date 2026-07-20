# QSL Maintenance — Flutter mobile app

A native Android/iOS app for the QSL Maintenance Management System. It talks to
the **same backend** as the web app over HTTPS, using token authentication.

This first version covers the **field core**:

- **Sign in** (token auth) with the server URL, stays signed in between launches.
- **Report registry** — list, filter by status, search, pull-to-refresh.
- **Report detail** — full checklist results, photos (tap to view full-screen &
  zoom), approval route and trail.
- **Approve / reject** — the routed reviewer approves or rejects with a comment,
  straight from the phone.
- **File a report** — pick any form your role allows (fetched live from the
  backend so the forms always match the web app), fill the checklists / fields /
  weekly test / choices, attach up to 6 **photos with GPS**, choose the reviewers,
  and submit.

Theme, colours and labels mirror the web app (`src/lib/theme.js`).

Later rounds can add schedule, quotations, calibration requests, the customer
survey and the client portal — the API client and screens are structured to
extend.

## Backend requirements

This app relies on two small backend additions (already in this repo):

- `POST /api/auth/mobile-login` → returns a JWT `{ token, user }`.
- Every protected route now also accepts `Authorization: Bearer <token>` (not
  only the browser cookie). See `src/lib/auth.js`.
- `GET /api/templates` → the report-form catalogue, so the app renders the exact
  same forms as the web app.

No other backend change is needed — the app reuses `/api/reports`,
`/api/reports/[serial]`, `/api/reports/[serial]/decision`, `/api/users/directory`
and `/api/clients`.

## Run it

Flutter isn't checked in with platform folders, so generate them once:

```bash
cd mobile
flutter create --platforms=android,ios .   # generates android/ and ios/ (keeps lib/ and pubspec.yaml)
flutter pub get
flutter run                                 # on a connected device/emulator
```

By default the app points at `https://reports.qalibrated.com`. You can change the
server on the login screen, or bake a default in at build time:

```bash
flutter run --dart-define=QSL_BASE_URL=https://reports.qalibrated.com
```

### Permissions to add

The camera + location features need platform permissions.

**Android** — in `android/app/src/main/AndroidManifest.xml`, inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
```

**iOS** — in `ios/Runner/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Attach photos of the weighbridge to your report.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Stamp your report photos with their location.</string>
```

### Build release APK

```bash
flutter build apk --release --dart-define=QSL_BASE_URL=https://reports.qalibrated.com
```

## Structure

```
lib/
  main.dart                 app entry + auth-gated routing
  theme.dart                brand palette + ThemeData
  api.dart                  ApiClient + models (token auth)
  session.dart              persisted auth state (secure storage)
  screens/
    login_screen.dart
    registry_screen.dart
    report_detail_screen.dart
    new_report_screen.dart  dynamic form from /api/templates
  widgets/common.dart       Brand, StatusPill, SectionBar, helpers
```
