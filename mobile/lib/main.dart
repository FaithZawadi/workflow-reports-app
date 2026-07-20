import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'theme.dart';
import 'session.dart';
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

class _Root extends StatelessWidget {
  const _Root();
  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    if (s.loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: kCoal)));
    }
    return s.signedIn ? const RegistryScreen() : const LoginScreen();
  }
}
