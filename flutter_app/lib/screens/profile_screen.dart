import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/auth_state.dart';
import '../core/nav.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import 'admin_screen.dart';
import 'manager_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final user = auth.user!;
    final initials = user.name.isEmpty
        ? '?'
        : user.name
              .trim()
              .split(RegExp(r'\s+'))
              .take(2)
              .map((w) => w[0].toUpperCase())
              .join();

    return SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 110),
        children: [
          const SectionHeader(
            title: 'Profile',
            subtitle: 'Your account and consoles.',
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.border, width: 0.8),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: AppColors.accent,
                  child: Text(
                    initials,
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                      color: AppColors.inkDeep,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.name,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        user.email,
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.mutedForeground,
                        ),
                      ),
                      if (user.phone != null && user.phone!.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Text(
                              user.phone!,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.mutedForeground,
                              ),
                            ),
                            const SizedBox(width: 6),
                            if (user.phoneVerified)
                              const Pill(
                                'Verified',
                                color: AppColors.success,
                                textColor: Colors.white,
                                icon: Icons.verified,
                              ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 8),
                      Pill(
                        user.role,
                        color: AppColors.inkDeep,
                        textColor: Colors.white,
                        icon: Icons.badge_outlined,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _actionTile(
            context,
            icon: Icons.local_activity_outlined,
            title: 'My tickets',
            subtitle: 'Bookings, payments, and cancellations',
            onTap: () => rootTabIndex.value = ticketsTab,
          ),
          if (user.isManager)
            _actionTile(
              context,
              icon: Icons.monitor_outlined,
              title: 'Manager console',
              subtitle: 'Schedule shows on assigned screens',
              onTap: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const ManagerScreen())),
            ),
          if (user.isAdmin)
            _actionTile(
              context,
              icon: Icons.admin_panel_settings_outlined,
              title: 'Admin console',
              subtitle: 'Catalog, scheduling, and revenue',
              onTap: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const AdminScreen())),
            ),
          const SizedBox(height: 18),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              side: BorderSide(color: AppColors.danger.withValues(alpha: 0.45)),
              minimumSize: const Size.fromHeight(48),
            ),
            onPressed: () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (dialogContext) => AlertDialog(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                  ),
                  title: const Text('Sign out?'),
                  content: const Text(
                    'You can sign back in anytime to see tickets.',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(dialogContext).pop(false),
                      child: const Text('Stay'),
                    ),
                    FilledButton(
                      onPressed: () => Navigator.of(dialogContext).pop(true),
                      child: const Text('Sign out'),
                    ),
                  ],
                ),
              );
              if (confirmed == true && context.mounted) {
                await context.read<AuthState>().logout();
                rootTabIndex.value = homeTab;
              }
            },
            icon: const Icon(Icons.logout, size: 18),
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }

  Widget _actionTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: ListTile(
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        leading: Container(
          padding: const EdgeInsets.all(9),
          decoration: BoxDecoration(
            color: AppColors.accent.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(11),
          ),
          child: Icon(icon, size: 21, color: AppColors.inkDeep),
        ),
        title: Text(
          title,
          style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
        ),
        subtitle: Text(
          subtitle,
          style: const TextStyle(
            fontSize: 12,
            color: AppColors.mutedForeground,
          ),
        ),
        trailing: const Icon(
          Icons.chevron_right,
          color: AppColors.mutedForeground,
        ),
      ),
    );
  }
}
