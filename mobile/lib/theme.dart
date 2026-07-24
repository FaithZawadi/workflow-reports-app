import 'package:flutter/material.dart';

// Brand palette — mirrors the web app (src/lib/theme.js).
const kGold = Color(0xFFF5A800);
const kCoal = Color(0xFF161310);
const kPaper = Color(0xFFF7F5F0);
const kInk = Color(0xFF26221C);
const kPass = Color(0xFF2E7D46);
const kFail = Color(0xFFB03A2E);
const kWait = Color(0xFF946B00);
const kLine = Color(0xFFDDD6C8);
const kMute = Color(0xFF6B6355);
const kBg = Color(0xFFF4F1EA); // app background (a touch warmer than paper)

// A soft shadow used on cards / sheets to give a modern, elevated feel.
const kSoftShadow = [BoxShadow(color: Color(0x14161310), blurRadius: 18, offset: Offset(0, 6))];
const kRadius = 16.0;

// Human labels for report statuses and roles (mirrors the web app).
const Map<String, String> kStatusLabel = {
  'PENDING_SUPERVISOR': 'Supervisor review',
  'PENDING_MANAGER': 'Manager approval',
  'APPROVED': 'Approved',
  'REJECTED': 'Rejected',
};
const Map<String, Color> kStatusColor = {
  'PENDING_SUPERVISOR': kWait,
  'PENDING_MANAGER': kWait,
  'APPROVED': kPass,
  'REJECTED': kFail,
};
const Map<String, String> kRoleLabel = {
  'TECHNICIAN': 'Site Technician',
  'ENGINEER': 'QSL Engineer',
  'SUPERVISOR': 'Equipment User',
  'MANAGER': 'Client/Manager',
  'PROJECT_MANAGER': 'Project Manager',
  'TECHNICAL_MANAGER': 'Technical Manager',
  'ADMIN': 'Administrator',
  'CLIENT': 'Client',
};

ThemeData buildTheme() {
  final base = ThemeData(useMaterial3: true, brightness: Brightness.light);
  return base.copyWith(
    scaffoldBackgroundColor: kBg,
    colorScheme: base.colorScheme.copyWith(
      primary: kCoal,
      secondary: kGold,
      surface: Colors.white,
      error: kFail,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: kCoal,
      foregroundColor: Colors.white,
      elevation: 0,
      centerTitle: false,
    ),
    // Inputs must be unmistakable on the warm app background: white field with
    // a visible line border, thickening to gold when focused.
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kLine, width: 1.2)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kLine, width: 1.2)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kGold, width: 1.8)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      hintStyle: const TextStyle(color: Color(0xFFA79E8C)),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: kGold,
        foregroundColor: kCoal,
        elevation: 0,
        minimumSize: const Size.fromHeight(52),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.3, fontSize: 16),
      ),
    ),
  );
}

// A reusable elevated card container (rounded, soft shadow) — modern mobile look.
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap});
  @override
  Widget build(BuildContext context) {
    final content = Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(kRadius), boxShadow: kSoftShadow),
      child: Padding(padding: padding, child: child),
    );
    if (onTap == null) return content;
    return Material(
      color: Colors.transparent,
      child: InkWell(borderRadius: BorderRadius.circular(kRadius), onTap: onTap, child: content),
    );
  }
}
