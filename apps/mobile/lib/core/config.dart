class AppConfig {
  /// Hosted API (EC2). Override for local:
  /// flutter run --dart-define=API_BASE_URL=http://192.168.1.3:4000
  static const hostedApiBaseUrl = 'http://15.252.43.40';

  static String get apiBaseUrl {
    const fromEnv = String.fromEnvironment('API_BASE_URL');
    if (fromEnv.isNotEmpty) {
      return fromEnv.endsWith('/') ? fromEnv.substring(0, fromEnv.length - 1) : fromEnv;
    }
    return hostedApiBaseUrl;
  }

  static String? mediaUrl(String? url) {
    if (url == null || url.trim().isEmpty) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    final path = url.startsWith('/') ? url : '/$url';
    return '$apiBaseUrl$path';
  }
}
