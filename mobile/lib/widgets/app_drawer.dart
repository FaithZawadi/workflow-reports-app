import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../session.dart';
import '../theme.dart';
import 'common.dart';

// The side navigation. Simple, neat and on-brand: a coal header carrying the
// QSL mark + who is signed in, then the three primary destinations and a sign
// out action. Tapping an item closes the drawer and switches tab via onNavigate.
class AppDrawer extends StatelessWidget {
  final int current;
  final void Function(int index) onNavigate;
  const AppDrawer({super.key, required this.current, required this.onNavigate});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    final user = s.user;
    final roleLine = user == null
        ? ''
        : (user.roles.isNotEmpty ? user.roles : [user.role]).map((r) => kRoleLabel[r] ?? r).join(' · ');

    return Drawer(
      backgroundColor: kBg,
      child: SafeArea(
        child: Column(children: [
          // Header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 22),
            decoration: const BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [kCoal, Color(0xFF2A2621)]),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const LogoMark(size: 46),
              const SizedBox(height: 14),
              Text(user?.name ?? 'QSL', style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w900)),
              if (roleLine.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Text(roleLine, style: const TextStyle(color: kGold, fontSize: 12, fontWeight: FontWeight.w700)),
                ),
              if (user?.email != null && user!.email.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(user.email, style: const TextStyle(color: Color(0xFFB8B1A4), fontSize: 11.5)),
                ),
            ]),
          ),
          const SizedBox(height: 8),
          _item(context, 0, Icons.insights_outlined, Icons.insights, 'Dashboard'),
          _item(context, 1, Icons.description_outlined, Icons.description, 'Reports'),
          _item(context, 2, Icons.account_circle_outlined, Icons.account_circle, 'Account'),
          const Spacer(),
          const Divider(height: 1, color: kLine),
          ListTile(
            leading: const Icon(Icons.logout, color: kFail),
            title: const Text('Sign out', style: TextStyle(fontWeight: FontWeight.w700, color: kFail)),
            onTap: () {
              Navigator.pop(context);
              context.read<Session>().logout();
            },
          ),
          const Padding(
            padding: EdgeInsets.only(bottom: 12, top: 2),
            child: Text('Qalibrated Systems Limited', style: TextStyle(color: kMute, fontSize: 11)),
          ),
        ]),
      ),
    );
  }

  Widget _item(BuildContext context, int index, IconData icon, IconData active, String label) {
    final selected = current == index;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      child: Material(
        color: selected ? Colors.white : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: ListTile(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          leading: Icon(selected ? active : icon, color: selected ? kCoal : kMute),
          title: Text(label, style: TextStyle(fontWeight: selected ? FontWeight.w800 : FontWeight.w600, color: selected ? kInk : kMute)),
          trailing: selected ? Container(width: 6, height: 6, decoration: const BoxDecoration(color: kGold, shape: BoxShape.circle)) : null,
          onTap: () {
            Navigator.pop(context);
            onNavigate(index);
          },
        ),
      ),
    );
  }
}
