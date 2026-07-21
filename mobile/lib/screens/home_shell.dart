import 'package:flutter/material.dart';
import '../theme.dart';
import 'dashboard_screen.dart';
import 'registry_screen.dart';
import 'tasks_screen.dart';
import 'account_screen.dart';

// Bottom-nav shell holding the three primary tabs. It owns the report filter
// state so a tap on a dashboard chart can jump straight into a filtered Reports
// list. Each tab keeps its own app bar + drawer + FAB.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _i = 0;

  // Filter passed down to the Reports tab. _nonce forces a reload even when the
  // same status is chosen twice (e.g. tapping the same donut slice again).
  String _status = 'all';
  String _query = '';
  int _nonce = 0;

  // Switch tabs (used by the drawer + dashboard "open" actions).
  void go(int i) => setState(() => _i = i);

  // Open the Reports tab pre-filtered from a dashboard chart.
  void openReports({String status = 'all', String query = ''}) {
    setState(() {
      _status = status;
      _query = query;
      _nonce++;
      _i = 1;
    });
  }

  @override
  Widget build(BuildContext context) {
    final tabs = [
      DashboardScreen(onOpenReports: openReports, onNavigate: go),
      RegistryScreen(status: _status, query: _query, filterNonce: _nonce, onNavigate: go),
      TasksScreen(onNavigate: go),
      AccountScreen(onNavigate: go),
    ];
    return Scaffold(
      body: IndexedStack(index: _i, children: tabs),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          boxShadow: [BoxShadow(color: Color(0x1A161310), blurRadius: 16, offset: Offset(0, -4))],
        ),
        child: SafeArea(
          top: false,
          child: BottomNavigationBar(
            currentIndex: _i,
            onTap: go,
            selectedItemColor: kCoal,
            unselectedItemColor: kMute,
            backgroundColor: Colors.white,
            elevation: 0,
            type: BottomNavigationBarType.fixed,
            selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5),
            unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11.5),
            items: const [
              BottomNavigationBarItem(icon: Icon(Icons.insights_outlined), activeIcon: Icon(Icons.insights), label: 'Dashboard'),
              BottomNavigationBarItem(icon: Icon(Icons.description_outlined), activeIcon: Icon(Icons.description), label: 'Reports'),
              BottomNavigationBarItem(icon: Icon(Icons.task_alt_outlined), activeIcon: Icon(Icons.task_alt), label: 'Tasks'),
              BottomNavigationBarItem(icon: Icon(Icons.account_circle_outlined), activeIcon: Icon(Icons.account_circle), label: 'Account'),
            ],
          ),
        ),
      ),
    );
  }
}
