import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform, kIsWeb;

class AppConfig {
  /// Override at run time:
  /// flutter run --dart-define=API_BASE_URL=http://192.168.1.3:4000
  ///
  /// Physical Android devices cannot use 10.0.2.2 (emulator-only).
  static String get apiBaseUrl {
    const fromEnv = String.fromEnvironment('API_BASE_URL');
    if (fromEnv.isNotEmpty) return fromEnv;
    // dart:io Platform is unavailable on web (Platform._operatingSystem).
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://192.168.1.3:4000';
    }
    return 'http://localhost:4000';
  }

  static String? mediaUrl(String? url) {
    if (url == null || url.trim().isEmpty) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    final path = url.startsWith('/') ? url : '/$url';
    return '$apiBaseUrl$path';
  }
}
