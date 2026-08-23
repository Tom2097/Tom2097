import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Thin wrapper around the values loaded from `.env` (via flutter_dotenv).
/// `.env` is gitignored -- see pubspec.yaml's `assets` entry and
/// `main.dart`'s `dotenv.load()` call.
class Env {
  Env._();

  static String get supabaseUrl => dotenv.get('SUPABASE_URL');
  static String get supabaseAnonKey => dotenv.get('SUPABASE_ANON_KEY');

  /// Base URL of the Next.js backend (app.digit-ai.org's API routes),
  /// e.g. `GET $apiBaseUrl/api/v1/billing/trials`.
  static String get apiBaseUrl => dotenv.get('API_BASE_URL');
}
