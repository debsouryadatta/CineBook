import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'config.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

/// Thin HTTP client around the CineBook REST API.
/// Mirrors the web app's fetch wrapper: JSON in/out, Bearer token,
/// `{message}` error envelopes.
class ApiClient {
  ApiClient._();

  static final ApiClient instance = ApiClient._();

  String? token;

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (token != null && token!.isNotEmpty) 'Authorization': 'Bearer $token',
  };

  Uri _uri(String path, [Map<String, String>? query]) {
    var uri = Uri.parse('${AppConfig.apiBaseUrl}$path');
    if (query != null && query.isNotEmpty) {
      uri = uri.replace(queryParameters: {...uri.queryParameters, ...query});
    }
    return uri;
  }

  Future<dynamic> get(String path, {Map<String, String>? query}) =>
      _request('GET', path, query: query);

  Future<dynamic> post(String path, [Map<String, dynamic>? body]) =>
      _request('POST', path, body: body);

  Future<dynamic> patch(String path, [Map<String, dynamic>? body]) =>
      _request('PATCH', path, body: body);

  Future<dynamic> _request(
    String method,
    String path, {
    Map<String, String>? query,
    Map<String, dynamic>? body,
  }) async {
    final uri = _uri(path, query);
    http.Response response;
    try {
      switch (method) {
        case 'GET':
          response = await http
              .get(uri, headers: _headers)
              .timeout(const Duration(seconds: 30));
        case 'POST':
          response = await http
              .post(uri, headers: _headers, body: jsonEncode(body ?? {}))
              .timeout(const Duration(seconds: 45));
        case 'PATCH':
          response = await http
              .patch(uri, headers: _headers, body: jsonEncode(body ?? {}))
              .timeout(const Duration(seconds: 45));
        default:
          throw ApiException('Unsupported method $method');
      }
    } on SocketException {
      throw ApiException('Network error. Check your internet connection.');
    } on TimeoutException {
      throw ApiException('The server took too long to respond. Try again.');
    } on http.ClientException {
      throw ApiException('Could not reach the CineBook server.');
    }

    return _decode(response);
  }

  dynamic _decode(http.Response response) {
    final text = response.body;
    dynamic data;
    if (text.isNotEmpty) {
      try {
        data = jsonDecode(text);
      } catch (_) {
        data = null;
      }
    }
    if (response.statusCode >= 400) {
      final message = (data is Map && data['message'] is String)
          ? data['message'] as String
          : 'Request failed';
      throw ApiException(message, statusCode: response.statusCode);
    }
    return data;
  }

  /// POSTs to an SSE endpoint and yields each decoded `data:` JSON event.
  Stream<Map<String, dynamic>> postStream(
    String path,
    Map<String, dynamic> body,
  ) async* {
    final client = http.Client();
    try {
      final request = http.Request('POST', _uri(path))
        ..headers.addAll({..._headers, 'Accept': 'text/event-stream'})
        ..body = jsonEncode(body);

      http.StreamedResponse response;
      try {
        response = await client.send(request);
      } on SocketException {
        throw ApiException('Network error. Check your internet connection.');
      } on http.ClientException {
        throw ApiException('Could not reach the CineBook server.');
      }

      if (response.statusCode >= 400) {
        final text = await response.stream.bytesToString();
        var message = 'Request failed';
        try {
          final data = jsonDecode(text);
          if (data is Map && data['message'] is String) {
            message = data['message'] as String;
          }
        } catch (_) {}
        throw ApiException(message, statusCode: response.statusCode);
      }

      var buffer = '';
      await for (final chunk in response.stream.transform(utf8.decoder)) {
        buffer += chunk;
        while (true) {
          final boundary = buffer.indexOf('\n\n');
          if (boundary == -1) break;
          final rawEvent = buffer.substring(0, boundary);
          buffer = buffer.substring(boundary + 2);
          for (final line in rawEvent.split('\n')) {
            if (!line.startsWith('data:')) continue;
            final payload = line.substring(5).trim();
            if (payload.isEmpty) continue;
            try {
              final decoded = jsonDecode(payload);
              if (decoded is Map<String, dynamic>) yield decoded;
            } catch (_) {
              // Ignore malformed SSE fragments.
            }
          }
        }
      }
    } finally {
      client.close();
    }
  }
}
