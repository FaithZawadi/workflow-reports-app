import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api.dart';

const kDefaultBaseUrl = String.fromEnvironment('QSL_BASE_URL', defaultValue: 'https://reports.qalibrated.com');

// Holds auth state for the whole app. Persists the token + server URL so the
// user stays signed in between launches.
class Session extends ChangeNotifier {
  final _store = const FlutterSecureStorage();
  late ApiClient api;
  AppUser? user;
  bool loading = true;
  String baseUrl = kDefaultBaseUrl;

  Session() {
    api = ApiClient(baseUrl);
    _restore();
  }

  bool get signedIn => user != null && api.token != null;

  Future<void> _restore() async {
    try {
      baseUrl = await _store.read(key: 'baseUrl') ?? kDefaultBaseUrl;
      final token = await _store.read(key: 'token');
      final userJson = await _store.read(key: 'user');
      api = ApiClient(baseUrl, token: token);
      if (token != null && userJson != null) {
        user = AppUser.fromJson(Map<String, dynamic>.from(jsonDecode(userJson)));
      }
    } catch (_) {}
    loading = false;
    notifyListeners();
  }

  Future<void> login(String url, String email, String password) async {
    baseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    api = ApiClient(baseUrl);
    final u = await api.login(email, password);
    user = u;
    await _store.write(key: 'baseUrl', value: baseUrl);
    await _store.write(key: 'token', value: api.token);
    await _store.write(key: 'user', value: jsonEncode(u.toJson()));
    notifyListeners();
  }

  Future<void> logout() async {
    user = null;
    api = ApiClient(baseUrl);
    await _store.delete(key: 'token');
    await _store.delete(key: 'user');
    notifyListeners();
  }
}
