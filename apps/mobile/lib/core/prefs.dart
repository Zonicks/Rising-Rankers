import 'package:shared_preferences/shared_preferences.dart';

class AppPrefs {
  static const onboardingKey = 'onboarding_seen_v1';
  static const newsBookmarkKey = 'rr_news_bookmarks';

  static Future<bool> onboardingSeen() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(onboardingKey) ?? false;
  }

  static Future<void> setOnboardingSeen() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(onboardingKey, true);
  }

  static Future<List<String>> newsBookmarks() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(newsBookmarkKey) ?? <String>[];
  }

  static Future<void> setNewsBookmarks(List<String> ids) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(newsBookmarkKey, ids);
  }
}
