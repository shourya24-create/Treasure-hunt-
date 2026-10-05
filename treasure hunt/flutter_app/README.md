# flutter_app

The Flutter app of The Echo Protocol: the team's phone (`lib/player/`) and the
admin dashboard (`lib/admin/`) in one **web** app. It cannot be built for
Android, iOS or desktop, because it uses `dart:html`.

- Screens, routes and widgets: [../UI.md](../UI.md)
- Colours, type and components: [../DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md),
  implemented in `lib/theme.dart` and `lib/widgets/`
- What it calls on the backend: [../BACKEND.md](../BACKEND.md)

## Commands

```
flutter pub get
flutter analyze
```

Two builds exist; pick one by flag:

| Build | Command | Talks to |
|---|---|---|
| Live site | `bash ../vercel/build.sh` (runs `flutter build web --dart-define=API_BASE=/api`) | the live Firebase project, and the callables at this site's `/api/<name>` |
| Local rehearsal | `flutter build web --dart-define=USE_EMULATORS=true` | the Firebase emulators on your machine |

Use `../vercel/build.sh` for the live build rather than typing the flag in Git
Bash, which would rewrite `/api` into a Windows path.
