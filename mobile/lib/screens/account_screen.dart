import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/app_drawer.dart';

// Profile + logout. Kept deliberately simple: who you are, the roles you hold,
// the client you belong to (if any), and a prominent sign-out.
class AccountScreen extends StatelessWidget {
  final void Function(int index) onNavigate;
  const AccountScreen({super.key, required this.onNavigate});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    final user = s.user;
    final roles = user == null ? <String>[] : (user.roles.isNotEmpty ? user.roles : [user.role]);

    return Scaffold(
      appBar: AppBar(title: const Brand(onDark: true)),
      drawer: AppDrawer(current: 3, onNavigate: onNavigate),
      body: user == null
          ? const SizedBox()
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
              children: [
                // Identity card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [kCoal, Color(0xFF2A2621)]),
                    borderRadius: BorderRadius.circular(kRadius),
                    boxShadow: kSoftShadow,
                  ),
                  child: Row(children: [
                    CircleAvatar(
                      radius: 30,
                      backgroundColor: kGold,
                      child: Text(_initials(user.name), style: const TextStyle(color: kCoal, fontWeight: FontWeight.w900, fontSize: 22)),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(user.name, style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w900)),
                        const SizedBox(height: 2),
                        Text(user.email, style: const TextStyle(color: Color(0xFFB8B1A4), fontSize: 13)),
                      ]),
                    ),
                  ]),
                ),
                const SizedBox(height: 16),

                const SectionBar('Roles'),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final r in roles)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: kSoftShadow),
                      child: Text(kRoleLabel[r] ?? r, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: kInk)),
                    ),
                ]),

                if (user.clientName != null && user.clientName!.isNotEmpty) ...[
                  const SectionBar('Organisation'),
                  _infoTile(Icons.business_outlined, 'Client', user.clientName!),
                ],

                const SectionBar('Connection'),
                _infoTile(Icons.verified_user_outlined, 'Signed in', 'Secure token active'),

                const SizedBox(height: 26),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(backgroundColor: kFail, foregroundColor: Colors.white),
                  icon: const Icon(Icons.logout),
                  label: const Text('Sign out'),
                  onPressed: () => _confirmLogout(context, s),
                ),
                const SizedBox(height: 16),
                const Center(child: Text('QSL Weighbridge · Qalibrated Systems Limited', style: TextStyle(color: kMute, fontSize: 11.5))),
              ],
            ),
    );
  }

  Widget _infoTile(IconData icon, String label, String value) => Container(
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(kRadius), boxShadow: kSoftShadow),
        child: Row(children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(color: const Color(0xFFF3F0E8), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 20, color: kCoal),
          ),
          const SizedBox(width: 12),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label.toUpperCase(), style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: kMute, letterSpacing: 0.3)),
            const SizedBox(height: 2),
            Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: kInk)),
          ]),
        ]),
      );

  void _confirmLogout(BuildContext context, Session s) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('You will need your email and password to sign back in.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel', style: TextStyle(color: kMute))),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              s.logout();
            },
            child: const Text('Sign out', style: TextStyle(color: kFail, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }
}
