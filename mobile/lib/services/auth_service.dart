import 'package:supabase_flutter/supabase_flutter.dart';

/// Thin wrapper around `supabase_flutter`'s auth client. Deliberately does
/// NOT build a custom auth client / token store -- supabase_flutter already
/// persists the session and handles refresh; this just exposes the calls
/// the screens need, mirroring exactly what the website's own API routes do
/// server-side (see app/api/auth/login/route.ts and
/// app/api/auth/sign-up/route.ts, both of which are thin wrappers around
/// the same `supabase.auth.signInWithPassword` / `supabase.auth.signUp`
/// calls used here).
class AuthService {
  AuthService._();

  static SupabaseClient get _client => Supabase.instance.client;

  static GoTrueClient get auth => _client.auth;

  static Session? get currentSession => _client.auth.currentSession;

  static bool get isSignedIn => currentSession != null;

  static Stream<AuthState> get onAuthStateChange => _client.auth.onAuthStateChange;

  static Future<AuthResponse> signInWithPassword({
    required String email,
    required String password,
  }) {
    return _client.auth.signInWithPassword(email: email, password: password);
  }

  /// Matches app/api/auth/sign-up/route.ts: full name and company name are
  /// carried as user_metadata (`full_name`, `company_name`) so the web
  /// backend's post-email-verification callback
  /// (app/auth/callback/route.ts -> ensureUserProfile()) can provision the
  /// organization/profile the same way it does for web signups. Email
  /// confirmation is required by the Supabase project config, so this
  /// intentionally does not return a usable session -- the user must verify
  /// their email first, same as on the website.
  static Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String fullName,
    required String companyName,
  }) {
    return _client.auth.signUp(
      email: email,
      password: password,
      data: {
        'full_name': fullName,
        'company_name': companyName,
      },
    );
  }

  /// Native mobile OAuth flow: opens the system browser/webview for Google
  /// sign-in and returns to the app via the `digitmobile://login-callback`
  /// deep link registered in the Android/iOS platform projects.
  ///
  /// TODO(google-oauth): This is structurally wired up but will not
  /// complete successfully until a mobile-capable Google OAuth client is
  /// configured. Specifically, once that exists:
  ///   1. In Supabase Dashboard -> Authentication -> URL Configuration, add
  ///      `org.digitai.digitmobile://login-callback` to "Redirect URLs".
  ///   2. In Supabase Dashboard -> Authentication -> Providers -> Google,
  ///      confirm the Google Client ID/Secret already used by the website
  ///      also permits this redirect URI (Supabase brokers the OAuth
  ///      exchange, so no separate Android/iOS Google Cloud OAuth client is
  ///      strictly required for this browser-based flow -- but if a native
  ///      Google Sign-In SDK is added later instead, that WOULD need
  ///      per-platform OAuth client IDs: an Android client keyed to the
  ///      app's package name (org.digitai.digitmobile) + debug/release
  ///      SHA-1 fingerprints, and an iOS client keyed to the bundle ID).
  ///   3. Confirm `android/app/src/main/AndroidManifest.xml` and
  ///      `ios/Runner/Info.plist` both declare the `digitmobile` URL scheme
  ///      (already added by this scaffold -- see TODO comments there).
  static Future<bool> signInWithGoogle() {
    return _client.auth.signInWithOAuth(
      OAuthProvider.google,
      redirectTo: 'org.digitai.digitmobile://login-callback',
      authScreenLaunchMode: LaunchMode.externalApplication,
    );
  }

  static Future<void> signOut() {
    return _client.auth.signOut();
  }
}
