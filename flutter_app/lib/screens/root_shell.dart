import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../core/auth_state.dart';
import '../core/nav.dart';
import '../core/theme.dart';
import 'bookings_screen.dart';
import 'chat_screen.dart';
import 'home_screen.dart';
import 'login_screen.dart';
import 'profile_screen.dart';

class RootShell extends StatefulWidget {
  const RootShell({super.key});

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  @override
  void initState() {
    super.initState();
    rootTabIndex.addListener(_onTab);
  }

  @override
  void dispose() {
    rootTabIndex.removeListener(_onTab);
    super.dispose();
  }

  void _onTab() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final index = rootTabIndex.value;

    // The home tab opens on a dark hero; every other tab is light.
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: index == homeTab
          ? SystemUiOverlayStyle.light
          : SystemUiOverlayStyle.dark,
      child: Scaffold(
        body: auth.loading
            ? const Center(child: CircularProgressIndicator())
            : IndexedStack(
                index: index,
                children: [
                  const HomeScreen(),
                  _AuthGate(
                    icon: Icons.local_activity_outlined,
                    title: 'Sign in to see your tickets',
                    message:
                        'Bookings, payment status, and cancellations live here.',
                    child: auth.user == null ? null : const BookingsScreen(),
                  ),
                  _AuthGate(
                    icon: Icons.smart_toy_outlined,
                    title: 'Sign in to chat with the concierge',
                    message:
                        'An agent that finds shows, holds seats, and checks out for you.',
                    child: auth.user == null ? null : const ChatScreen(),
                  ),
                  _AuthGate(
                    icon: Icons.person_outline,
                    title: 'Sign in to manage your account',
                    message: 'Profile, roles, and console access.',
                    child: auth.user == null ? null : const ProfileScreen(),
                  ),
                ],
              ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: index,
          onDestinationSelected: (i) => rootTabIndex.value = i,
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home),
              label: 'Home',
            ),
            NavigationDestination(
              icon: Icon(Icons.local_activity_outlined),
              selectedIcon: Icon(Icons.local_activity),
              label: 'Tickets',
            ),
            NavigationDestination(
              icon: Icon(Icons.chat_bubble_outline),
              selectedIcon: Icon(Icons.chat_bubble),
              label: 'Chat',
            ),
            NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }
}

/// Shows [child] when signed in, otherwise a friendly sign-in prompt.
class _AuthGate extends StatelessWidget {
  const _AuthGate({
    required this.icon,
    required this.title,
    required this.message,
    required this.child,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    if (child != null) return child!;
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Icon(icon, size: 34, color: AppColors.inkDeep),
              ),
              const SizedBox(height: 16),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13.5,
                  height: 1.45,
                  color: AppColors.mutedForeground,
                ),
              ),
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: () => Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (_) => const LoginScreen())),
                icon: const Icon(Icons.login, size: 18),
                label: const Text('Sign in'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
