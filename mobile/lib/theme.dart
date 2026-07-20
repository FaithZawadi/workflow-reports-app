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
    scaffoldBackgroundColor: kPaper,
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
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: kLine)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: kLine)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: kCoal, width: 1.5)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      isDense: true,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: kGold,
        foregroundColor: kCoal,
        elevation: 0,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.3),
      ),
    ),
  );
}
