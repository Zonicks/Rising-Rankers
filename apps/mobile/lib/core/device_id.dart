import 'package:shared_preferences/shared_preferences.dart';

class DeviceId {
  static const _key = 'device_id';

  /// Stable per-install id for live-test device binding.
  static Future<String> get() async {
    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString(_key);
    if (id == null || id.isEmpty) {
      id = 'flutter-${DateTime.now().microsecondsSinceEpoch}-${_rand()}';
      await prefs.setString(_key, id);
    }
    return id;
  }

  static String _rand() => (DateTime.now().millisecondsSinceEpoch % 99991).toRadixString(36);
}
