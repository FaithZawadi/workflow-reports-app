import 'package:flutter/material.dart';
import '../theme.dart';
import 'dashboard_screen.dart';
import 'registry_screen.dart';

// Bottom-nav shell: Dashboard + Reports. Each tab keeps its own app bar / FAB.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _i = 0;
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _i, children: const [DashboardScreen(), RegistryScreen()]),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _i,
        onTap: (i) => setState(() => _i = i),
        selectedItemColor: kCoal,
        unselectedItemColor: kMute,
        backgroundColor: Colors.white,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.insights_outlined), activeIcon: Icon(Icons.insights), label: 'Dashboard'),
          BottomNavigationBarItem(icon: Icon(Icons.description_outlined), activeIcon: Icon(Icons.description), label: 'Reports'),
        ],
      ),
    );
  }
}
