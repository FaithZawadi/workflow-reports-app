import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'theme.dart';
import 'session.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/registry_screen.dart';

void main() => runApp(const QslApp());

class QslApp extends StatelessWidget {
  const QslApp({super.key});
  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => Session(),
      child: MaterialApp(
        title: 'QSL Maintenance',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        home: const _Root(),
      ),
    );
  }
}

class _Root extends StatefulWidget {
  const _Root();
  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> {
  bool _minElapsed = false;

  @override
  void initState() {
    super.initState();
    // Keep the animated splash up for a beat even if the session restores instantly.
    Future.delayed(const Duration(milliseconds: 2200), () {
      if (mounted) setState(() => _minElapsed = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    final ready = !s.loading && _minElapsed;
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 350),
      child: !ready
          ? const SplashScreen()
          : (s.signedIn ? const RegistryScreen() : const LoginScreen()),
    );
  }
}
