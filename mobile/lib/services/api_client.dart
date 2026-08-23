import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import 'env.dart';

/// Calls the Next.js backend's `/api/v1/*` routes, attaching the current
/// Supabase session's access token as `Authorization: Bearer <token>` on
/// every request.
///
/// This mirrors `getBearerToken()` in the web app's `lib/supabase/server.ts`:
/// that function reads this exact header as an alternative to the
/// cookie-based session a browser would send, specifically so a native
/// mobile client (no cookies) can authenticate. See also
/// `getAuthenticatedUser()` in `lib/auth/server-auth.ts`, which calls
/// `supabase.auth.getUser(bearerToken)` when this header is present.
class ApiException implements Exception {
  ApiException(this.statusCode, this.message);

  final int statusCode;
  final String message;

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiClient {
  ApiClient._();

  static final Uri _base = Uri.parse(Env.apiBaseUrl);

  static String? get _accessToken =>
      Supabase.instance.client.auth.currentSession?.accessToken;

  static Map<String, String> _headers({Map<String, String>? extra}) {
    final token = _accessToken;
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      ...?extra,
    };
  }

  static Future<dynamic> get(String path) async {
    final uri = _base.resolve(path);
    final response = await http.get(uri, headers: _headers());
    return _decode(response);
  }

  static Future<dynamic> post(String path, {Object? body}) async {
    final uri = _base.resolve(path);
    final response = await http.post(
      uri,
      headers: _headers(),
      body: body == null ? null : jsonEncode(body),
    );
    return _decode(response);
  }

  static dynamic _decode(http.Response response) {
    dynamic decoded;
    try {
      decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    } on FormatException {
      decoded = response.body;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = (decoded is Map && decoded['error'] is String)
          ? decoded['error'] as String
          : 'Request failed with status ${response.statusCode}';
      throw ApiException(response.statusCode, message);
    }

    return decoded;
  }
}
