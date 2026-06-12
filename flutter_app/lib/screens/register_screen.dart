import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../core/auth_state.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import 'login_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
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
      await context.read<AuthState>().register(
        name: _name.text.trim(),
        email: _email.text.trim(),
        password: _password.text,
        phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(
      text,
      style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
    ),
  );

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
                    title: 'Create your account',
                    subtitle:
                        'Book seats in seconds and keep every ticket in one place.',
                  ),
                  const SizedBox(height: 24),
                  Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _label('Name'),
                        TextFormField(
                          controller: _name,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(
                            hintText: 'Your full name',
                          ),
                          validator: (v) => (v == null || v.trim().length < 2)
                              ? 'Name must be at least 2 characters'
                              : null,
                        ),
                        const SizedBox(height: 14),
                        _label('Email'),
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
                        _label('Phone (optional)'),
                        TextFormField(
                          controller: _phone,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(
                            hintText: '+919000000000',
                          ),
                          validator: (v) {
                            final t = v?.trim() ?? '';
                            if (t.isNotEmpty && t.length < 8) {
                              return 'Phone must be at least 8 digits';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Phone verification is simulated with code 123456.',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.mutedForeground,
                          ),
                        ),
                        const SizedBox(height: 14),
                        _label('Password'),
                        TextFormField(
                          controller: _password,
                          obscureText: true,
                          decoration: const InputDecoration(
                            hintText: 'At least 8 characters',
                          ),
                          validator: (v) => (v == null || v.length < 8)
                              ? 'Password must be at least 8 characters'
                              : null,
                          onFieldSubmitted: (_) => _submit(),
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
                              : const Icon(Icons.person_add_alt_1, size: 19),
                          label: Text(
                            _busy ? 'Creating account…' : 'Create account',
                          ),
                        ),
                        const SizedBox(height: 14),
                        Center(
                          child: TextButton(
                            onPressed: _busy
                                ? null
                                : () => Navigator.of(context).pushReplacement(
                                    MaterialPageRoute(
                                      builder: (_) => const LoginScreen(),
                                    ),
                                  ),
                            child: const Text.rich(
                              TextSpan(
                                text: 'Already have an account?  ',
                                style: TextStyle(
                                  color: AppColors.mutedForeground,
                                  fontWeight: FontWeight.w500,
                                ),
                                children: [
                                  TextSpan(
                                    text: 'Sign in',
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
