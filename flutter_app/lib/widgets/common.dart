import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/theme.dart';
import '../models/models.dart';

String formatMoney(num amount) => '₹${NumberFormat('#,##0').format(amount)}';

String formatShowTime(DateTime? dt) =>
    dt == null ? '—' : DateFormat('EEE, d MMM • h:mm a').format(dt.toLocal());

String formatDay(DateTime? dt) =>
    dt == null ? '—' : DateFormat('EEE, d MMM').format(dt.toLocal());

String formatClock(DateTime? dt) =>
    dt == null ? '—' : DateFormat('h:mm a').format(dt.toLocal());

Color bookingStatusColor(String status) => switch (status) {
  'CONFIRMED' => AppColors.success,
  'CANCELLED' => AppColors.danger,
  _ => AppColors.mutedForeground,
};

class Pill extends StatelessWidget {
  const Pill(
    this.text, {
    super.key,
    this.color,
    this.textColor,
    this.icon,
    this.outlined = false,
  });

  final String text;
  final Color? color;
  final Color? textColor;
  final IconData? icon;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    final bg = color ?? AppColors.muted;
    final fg = textColor ?? AppColors.ink;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: outlined ? Colors.transparent : bg,
        borderRadius: BorderRadius.circular(20),
        border: outlined ? Border.all(color: bg) : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: fg),
            const SizedBox(width: 4),
          ],
          Text(
            text,
            style: TextStyle(
              color: fg,
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 21,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.4,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 3),
                Text(
                  subtitle!,
                  style: const TextStyle(
                    fontSize: 13.5,
                    color: AppColors.mutedForeground,
                  ),
                ),
              ],
            ],
          ),
        ),
        ?trailing,
      ],
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
  });

  final IconData icon;
  final String title;
  final String? message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 24),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: Column(
        children: [
          Icon(icon, size: 34, color: AppColors.mutedForeground),
          const SizedBox(height: 10),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800),
          ),
          if (message != null) ...[
            const SizedBox(height: 5),
            Text(
              message!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.mutedForeground,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.danger, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: AppColors.danger,
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class PosterImage extends StatelessWidget {
  const PosterImage(
    this.url, {
    super.key,
    this.fit = BoxFit.cover,
    this.borderRadius,
  });

  final String url;
  final BoxFit fit;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final image = url.isEmpty
        ? Container(
            color: AppColors.muted,
            alignment: Alignment.center,
            child: const Icon(
              Icons.movie_outlined,
              color: AppColors.mutedForeground,
              size: 32,
            ),
          )
        : CachedNetworkImage(
            imageUrl: url,
            fit: fit,
            placeholder: (_, _) => Container(color: AppColors.muted),
            errorWidget: (_, _, _) => Container(
              color: AppColors.muted,
              alignment: Alignment.center,
              child: const Icon(
                Icons.movie_outlined,
                color: AppColors.mutedForeground,
                size: 32,
              ),
            ),
          );
    if (borderRadius != null) {
      return ClipRRect(borderRadius: borderRadius!, child: image);
    }
    return image;
  }
}

class MovieCard extends StatelessWidget {
  const MovieCard({super.key, required this.movie, required this.onTap});

  final Movie movie;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border, width: 0.8),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  PosterImage(movie.posterUrl),
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Pill(
                      movie.genre,
                      color: AppColors.inkDeep.withValues(alpha: 0.78),
                      textColor: Colors.white,
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Pill(
                      '${movie.durationMin} min',
                      color: AppColors.inkDeep.withValues(alpha: 0.78),
                      textColor: Colors.white,
                      icon: Icons.schedule,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    movie.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    movie.synopsis,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11.5,
                      height: 1.35,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(
                        Icons.chair_outlined,
                        size: 14,
                        color: AppColors.inkDeep,
                      ),
                      const SizedBox(width: 4),
                      const Text(
                        'Select seats',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        movie.language,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.mutedForeground,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
