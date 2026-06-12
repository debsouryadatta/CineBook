import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';
import 'api_client.dart';
import 'config.dart';

class AuthState extends ChangeNotifier {
  User? user;
  bool loading = true;

  final ApiClient _api = ApiClient.instance;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(AppConfig.tokenStorageKey);
    if (token == null || token.isEmpty) {
      loading = false;
      notifyListeners();
      return;
    }
    _api.token = token;
    try {
      final data = await _api.get('/auth/me');
      user = User.fromJson((data['user'] as Map).cast<String, dynamic>());
    } catch (_) {
      _api.token = null;
      await prefs.remove(AppConfig.tokenStorageKey);
    }
    loading = false;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final data = await _api.post('/auth/login', {
      'email': email,
      'password': password,
    });
    await _storeSession(data);
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
    String? phone,
  }) async {
    final data = await _api.post('/auth/register', {
      'name': name,
      'email': email,
      'password': password,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
    });
    await _storeSession(data);
    if (phone != null && phone.isNotEmpty) {
      // Phone verification is simulated by the backend with a fixed code.
      try {
        await _api.post('/auth/phone/request', {'phone': phone});
        await _api.post('/auth/phone/verify', {
          'phone': phone,
          'code': AppConfig.simulatedPhoneCode,
        });
        await refreshMe();
      } catch (_) {
        // Verification is optional; account creation already succeeded.
      }
    }
  }

  Future<void> refreshMe() async {
    try {
      final data = await _api.get('/auth/me');
      user = User.fromJson((data['user'] as Map).cast<String, dynamic>());
      notifyListeners();
    } catch (_) {}
  }

  Future<void> _storeSession(dynamic data) async {
    final token = data['token'] as String;
    _api.token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConfig.tokenStorageKey, token);
    user = User.fromJson((data['user'] as Map).cast<String, dynamic>());
    notifyListeners();
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConfig.tokenStorageKey);
    _api.token = null;
    user = null;
    notifyListeners();
  }
}
