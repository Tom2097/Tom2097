import 'dart:io' show Platform;

import 'package:google_sign_in/google_sign_in.dart';
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

  // The Web OAuth client ID (same one app/auth/login/page.tsx uses for
  // Google Identity Services) -- passed as serverClientId so the ID token
  // GoogleSignIn returns has an audience Supabase's Google provider (which
  // is configured with this same client) will actually accept. This is NOT
  // the Android/iOS OAuth client below; those exist only so Google will let
  // this app run the native picker at all (verified by package name/SHA-1
  // or bundle ID), they don't appear in the token exchange itself.
  static const _webClientId =
      '484920780271-2nvkm79usc6g0j62ihbbiti55m5nublm.apps.googleusercontent.com';

  // TODO(google-oauth-ios): iOS's GoogleSignIn implementation (unlike
  // Android's, which verifies via package name + SHA-1 at the OS level)
  // needs its own OAuth client ID passed explicitly. Create it in Google
  // Cloud Console -> Credentials -> Create Credentials -> OAuth client ID
  // -> iOS, bundle ID org.digitai.digitMobile, then paste the resulting
  // client ID here AND its REVERSED_CLIENT_ID into
  // ios/Runner/Info.plist's CFBundleURLSchemes (see the TODO there).
  static const _iosClientId = 'TODO-REPLACE-WITH-IOS-CLIENT-ID.apps.googleusercontent.com';

  static bool _googleInitialized = false;

  static Future<void> _ensureGoogleInitialized() async {
    if (_googleInitialized) return;
    await GoogleSignIn.instance.initialize(
      clientId: Platform.isIOS ? _iosClientId : null,
      serverClientId: _webClientId,
    );
    _googleInitialized = true;
  }

  /// Native Google Sign-In: the OS-native account picker authenticates
  /// directly against Google (no browser, no redirect through Supabase's
  /// own domain), returning a signed ID token that's handed to Supabase
  /// via signInWithIdToken(). Deliberately NOT signInWithOAuth() -- that
  /// redirects through the Supabase project's own `.supabase.co` domain,
  /// which is exactly the branding problem already fixed on the website (see
  /// GoogleIdentityButton in the web app) by switching to this same
  /// token-based approach instead of a hosted redirect.
  ///
  /// Requires an Android OAuth client (package org.digitai.digit_mobile +
  /// the app's signing SHA-1) and an iOS OAuth client (bundle id
  /// org.digitai.digitMobile) to exist in Google Cloud Console -- without
  /// those, GoogleSignIn.instance.authenticate() itself fails before any
  /// token is ever produced, regardless of the web client ID above.
  static Future<AuthResponse> signInWithGoogle() async {
    await _ensureGoogleInitialized();
    final account = await GoogleSignIn.instance.authenticate();
    final idToken = account.authentication.idToken;
    if (idToken == null) {
      throw const AuthException('Google did not return an ID token.');
    }
    return _client.auth.signInWithIdToken(
      provider: OAuthProvider.google,
      idToken: idToken,
    );
  }

  static Future<void> signOut() {
    return _client.auth.signOut();
  }
}
