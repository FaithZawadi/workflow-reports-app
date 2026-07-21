# QSL Maintenance — Flutter mobile app

A native Android/iOS app for the QSL Maintenance Management System. It talks to
the **same backend** as the web app over HTTPS, using token authentication.

It covers:

- **Animated splash + sign in** (token auth). The backend URL is baked in at
  build time and **hidden** — the user only sees email + password. Stays signed
  in between launches.
- **Dashboard** — role-aware KPIs and **fully interactive charts**. Tap a donut
  slice, a KPI tile or a recent-activity row to drill straight into the matching
  reports. A "Viewing as" role dropdown re-lenses the dashboard for users who
  hold more than one role. Auto-syncs every 30s and on pull-to-refresh.
- **Report registry** — list, filter by status, search, pull-to-refresh. Opens
  pre-filtered when you arrive from a dashboard chart.
- **Report detail** — full checklist results, photos (tap to view full-screen &
  zoom), approval route and trail.
- **Approve / reject** — the routed reviewer approves or rejects with a comment,
  straight from the phone.
- **File a report** — pick any form your role allows (fetched live from the
  backend so the forms always match the web app), fill the checklists / fields /
  weekly test / choices, attach up to 6 **photos with GPS**, choose the reviewers,
  and submit.
- **Tasks** — a bold status board mirroring the web app: **Open · In progress ·
  Blocked · Done**, plus derived **Unassigned** and **Overdue** tiles, each with a
  live count from the database. Tap a tile to filter; change a task's status
  inline (managers, or the task's assignee).
- **Account** — profile (name, email, roles, organisation) and sign out.

### Navigation

- **Bottom navigation** — four primary tabs: **Dashboard · Reports · Tasks · Account**.
- **Sidebar drawer** — swipe from the left / tap the menu icon for the same
  destinations plus a prominent sign-out, headed by who is signed in.

Theme, colours and labels mirror the web app (`src/lib/theme.js`).

## Backend requirements

This app relies on two small backend additions (already in this repo):

- `POST /api/auth/mobile-login` → returns a JWT `{ token, user }`.
- Every protected route now also accepts `Authorization: Bearer <token>` (not
  only the browser cookie). See `src/lib/auth.js`.
- `GET /api/templates` → the report-form catalogue, so the app renders the exact
  same forms as the web app.
- `GET /api/tasks` + `PATCH /api/tasks/[id]` → the task board and inline status
  changes (both already used by the web app).

No other backend change is needed — the app reuses `/api/reports`,
`/api/reports/[serial]`, `/api/reports/[serial]/decision`, `/api/users/directory`,
`/api/clients` and `/api/stats` (the role-scoped dashboard metrics).

## Run it

Flutter isn't checked in with platform folders, so generate them once:

```bash
cd mobile
flutter create --platforms=android,ios .   # generates android/ and ios/ (keeps lib/ and pubspec.yaml)
flutter pub get
flutter run                                 # on a connected device/emulator
```

By default the app points at `https://reports.qalibrated.com`. The server URL is
**not** shown to the user; override it at build time for staging:

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

### Ship a release build

**Android APK** (side-load / direct install):

```bash
flutter build apk --release --dart-define=QSL_BASE_URL=https://reports.qalibrated.com
# output: build/app/outputs/flutter-apk/app-release.apk
```

**Android App Bundle** (Google Play upload):

```bash
flutter build appbundle --release --dart-define=QSL_BASE_URL=https://reports.qalibrated.com
# output: build/app/outputs/bundle/release/app-release.aab
```

A Play Store upload also needs an **upload keystore** wired into
`android/key.properties` + `android/app/build.gradle` (Flutter's
[app signing guide](https://docs.flutter.dev/deployment/android#signing-the-app)).

**iOS** (requires a Mac + Xcode + an Apple Developer account):

```bash
flutter build ipa --release --dart-define=QSL_BASE_URL=https://reports.qalibrated.com
# then upload build/ios/archive/*.xcarchive via Xcode Organizer / Transporter
```

### Pre-release checklist

- [ ] `flutter pub get` then a full restart (not hot reload) after pulling changes.
- [ ] `flutter analyze` is clean.
- [ ] Android manifest permissions + iOS Info.plist keys added (above).
- [ ] App icons generated (`assets/brand/` art → launcher icons).
- [ ] Backend reachable over **HTTPS** at the baked `QSL_BASE_URL`
      (`/api/auth/mobile-login` returns `{ token, user }`).

## Structure

```
lib/
  main.dart                 app entry + animated-splash + auth-gated routing
  theme.dart                brand palette + ThemeData + AppCard
  api.dart                  ApiClient + models (token auth, /api/stats)
  session.dart              persisted auth state (secure storage), hidden baseUrl
  screens/
    splash_screen.dart      animated QSL splash
    login_screen.dart       email + password only (server hidden)
    home_shell.dart         bottom-nav shell (Dashboard/Reports/Account) + filter state
    dashboard_screen.dart   role-aware KPIs + interactive charts + role dropdown
    registry_screen.dart    report list; reacts to chart drill-down filters
    report_detail_screen.dart
    new_report_screen.dart  dynamic form from /api/templates
    tasks_screen.dart       status-tile board + inline status changes
    account_screen.dart     profile + sign out
  widgets/
    common.dart             Brand, LogoMark, StatusPill, Serial, SectionBar
    charts.dart             StatTile, Donut, BarList, Trend, Gauge (all tappable)
    app_drawer.dart         the sidebar navigation
```
