import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'config.dart';

class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  static const _tokenKey = 'auth_token';

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  Future<void> setToken(String? token) async {
    final prefs = await SharedPreferences.getInstance();
    if (token == null || token.isEmpty) {
      await prefs.remove(_tokenKey);
    } else {
      await prefs.setString(_tokenKey, token);
    }
  }

  Future<Map<String, dynamic>> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool auth = false,
  }) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}$path');
    final headers = <String, String>{
      'Accept': 'application/json',
    };
    if (method != 'GET') {
      headers['Content-Type'] = 'application/json';
    }
    if (auth) {
      final token = await getToken();
      if (token != null) headers['Authorization'] = 'Bearer $token';
    }

    late http.Response res;
    final encoded = body == null ? null : jsonEncode(body);
    switch (method) {
      case 'GET':
        res = await _client.get(uri, headers: headers);
        break;
      case 'POST':
        res = await _client.post(uri, headers: headers, body: encoded ?? '{}');
        break;
      case 'PATCH':
        res = await _client.patch(uri, headers: headers, body: encoded ?? '{}');
        break;
      default:
        throw Exception('Unsupported method $method');
    }

    final decoded = _decode(res.body);
    if (res.statusCode >= 400) {
      final err = decoded['error'];
      final errMap = err is Map ? Map<String, dynamic>.from(err) : null;
      throw ApiException(
        statusCode: res.statusCode,
        code: errMap?['code']?.toString() ?? decoded['code']?.toString() ?? 'ERROR',
        message: errMap?['message']?.toString() ??
            decoded['message']?.toString() ??
            (err is String ? err : null) ??
            'Request failed',
        details: errMap?['details'],
      );
    }
    return decoded;
  }

  Map<String, dynamic> _decode(String body) {
    if (body.isEmpty) return {};
    try {
      final raw = jsonDecode(body);
      if (raw is Map<String, dynamic>) return raw;
      if (raw is Map) return Map<String, dynamic>.from(raw);
    } catch (_) {}
    return {};
  }
}

class ApiException implements Exception {
  ApiException({
    required this.statusCode,
    required this.code,
    required this.message,
    this.details,
  });

  final int statusCode;
  final String code;
  final String message;
  final dynamic details;

  @override
  String toString() => message;
}

final apiClient = ApiClient();
