import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../core/auth_state.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController(text: 'demo@cinebook.local');
  final _password = TextEditingController(text: 'Demo@123');
  final _formKey = GlobalKey<FormState>();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AuthState>().login(_email.text.trim(), _password.text);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const AuthHero(
                    title: 'Welcome back',
                    subtitle:
                        'Sign in to reserve seats, track tickets, and chat with the concierge.',
                  ),
                  const SizedBox(height: 24),
                  Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Email',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          autocorrect: false,
                          decoration: const InputDecoration(
                            hintText: 'you@example.com',
                          ),
                          validator: (v) => (v == null || !v.contains('@'))
                              ? 'Enter a valid email'
                              : null,
                        ),
                        const SizedBox(height: 14),
                        const Text(
                          'Password',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _password,
                          obscureText: true,
                          decoration: const InputDecoration(
                            hintText: '••••••••',
                          ),
                          validator: (v) => (v == null || v.isEmpty)
                              ? 'Password is required'
                              : null,
                          onFieldSubmitted: (_) => _submit(),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'Demo credentials are prefilled — just tap Sign in.',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: AppColors.mutedForeground,
                          ),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          ErrorBanner(_error!),
                        ],
                        const SizedBox(height: 18),
                        FilledButton.icon(
                          onPressed: _busy ? null : _submit,
                          icon: _busy
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.4,
                                    color: AppColors.inkDeep,
                                  ),
                                )
                              : const Icon(Icons.login, size: 19),
                          label: Text(_busy ? 'Signing in…' : 'Sign in'),
                        ),
                        const SizedBox(height: 14),
                        Center(
                          child: TextButton(
                            onPressed: _busy
                                ? null
                                : () => Navigator.of(context).pushReplacement(
                                    MaterialPageRoute(
                                      builder: (_) => const RegisterScreen(),
                                    ),
                                  ),
                            child: const Text.rich(
                              TextSpan(
                                text: 'New to CineBook?  ',
                                style: TextStyle(
                                  color: AppColors.mutedForeground,
                                  fontWeight: FontWeight.w500,
                                ),
                                children: [
                                  TextSpan(
                                    text: 'Create account',
                                    style: TextStyle(
                                      color: AppColors.ink,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Shared dark gradient header used by the auth screens.
class AuthHero extends StatelessWidget {
  const AuthHero({super.key, required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.inkDeep, Color(0xFF1A2236)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.movie_creation_outlined,
                  color: AppColors.inkDeep,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'CineBook',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 19,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.75),
              fontSize: 13.5,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}
