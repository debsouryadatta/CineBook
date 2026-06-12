/// App-wide configuration constants.
class AppConfig {
  AppConfig._();

  /// CineBook backend base URL (same server the React frontend proxies to).
  static const String apiBaseUrl = 'http://141.148.222.67:4000/api';

  /// Key used to persist the JWT, mirrors the web app's localStorage key.
  static const String tokenStorageKey = 'cinebook-token';

  /// Simulated phone verification code accepted by the backend.
  static const String simulatedPhoneCode = '123456';

  /// Default card number for the simulated payment gateway.
  static const String defaultTestCard = '4242424242424242';
}
