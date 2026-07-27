import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// A tiny on-device cache for API responses so the app behaves like a normal
// app offline: the last-seen registry, report, dashboard and tasks stay
// available (and no bare "Not signed in" error) when the network or token is
// briefly unavailable. Stored via the same encrypted secure storage as the
// token — cleared on sign-out.
class LocalCache {
  static const _s = FlutterSecureStorage();

  static Future<void> put(String key, dynamic json) async {
    try {
      await _s.write(key: 'cache:$key', value: jsonEncode(json));
    } catch (_) {}
  }

  static Future<dynamic> get(String key) async {
    try {
      final v = await _s.read(key: 'cache:$key');
      return v == null ? null : jsonDecode(v);
    } catch (_) {
      return null;
    }
  }

  // Wipe every cached response (called on sign-out) without touching the
  // token/user/baseUrl keys.
  static Future<void> clear() async {
    try {
      final all = await _s.readAll();
      for (final k in all.keys) {
        if (k.startsWith('cache:')) await _s.delete(key: k);
      }
    } catch (_) {}
  }
}
