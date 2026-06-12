import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/nav.dart';
import '../core/theme.dart';
import '../models/models.dart';
import '../widgets/common.dart';

class BookingsScreen extends StatefulWidget {
  const BookingsScreen({super.key});

  @override
  State<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends State<BookingsScreen> {
  final _api = ApiClient.instance;

  List<Booking> _bookings = [];
  bool _loading = true;
  String? _error;
  String? _cancelingId;
  Timer? _pendingPoll;

  @override
  void initState() {
    super.initState();
    _load();
    rootTabIndex.addListener(_onTabChanged);
    // While any booking is pending the worker may confirm it any moment;
    // mirror the web app's fast refresh.
    _pendingPoll = Timer.periodic(const Duration(milliseconds: 1500), (_) {
      if (!_loading &&
          rootTabIndex.value == ticketsTab &&
          _bookings.any((b) => b.isPending)) {
        _load(silent: true);
      }
    });
  }

  @override
  void dispose() {
    rootTabIndex.removeListener(_onTabChanged);
    _pendingPoll?.cancel();
    super.dispose();
  }

  void _onTabChanged() {
    if (rootTabIndex.value == ticketsTab) _load(silent: true);
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final data = await _api.get('/bookings');
      if (!mounted) return;
      setState(() {
        _bookings = ((data['bookings'] as List?) ?? [])
            .whereType<Map<String, dynamic>>()
            .map(Booking.fromJson)
            .toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        if (!silent) _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _cancel(Booking booking) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Cancel this booking?'),
        content: Text(
          '${booking.show?.movie?.title ?? 'This show'} — seats ${booking.seatLabels}. '
          'Successful payments are refunded automatically.',
          style: const TextStyle(height: 1.45),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Keep booking'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Cancel booking'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _cancelingId = booking.id);
    try {
      await _api.patch('/bookings/${booking.id}/cancel');
      await _load(silent: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _cancelingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: () => _load(silent: true),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 4),
              sliver: SliverToBoxAdapter(
                child: SectionHeader(
                  title: 'Your tickets',
                  subtitle: 'Pending tickets refresh automatically.',
                  trailing: Pill(
                    '${_bookings.length} total',
                    icon: Icons.local_activity_outlined,
                  ),
                ),
              ),
            ),
            if (_error != null)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                sliver: SliverToBoxAdapter(child: ErrorBanner(_error!)),
              ),
            if (_loading)
              const SliverPadding(
                padding: EdgeInsets.symmetric(vertical: 80),
                sliver: SliverToBoxAdapter(
                  child: Center(child: CircularProgressIndicator()),
                ),
              )
            else if (_bookings.isEmpty)
              const SliverPadding(
                padding: EdgeInsets.fromLTRB(16, 18, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: EmptyState(
                    icon: Icons.local_activity_outlined,
                    title: 'No bookings yet',
                    message:
                        'Choose a showtime on Home and your tickets will land here.',
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 110),
                sliver: SliverList.separated(
                  itemCount: _bookings.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (context, i) => _ticketCard(_bookings[i]),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _ticketCard(Booking booking) {
    final show = booking.show;
    final theater = show?.screen?.theater;
    final statusColor = bookingStatusColor(booking.status);
    final canceling = _cancelingId == booking.id;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border, width: 0.8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Pill(booking.confirmationCode, icon: Icons.qr_code_2),
              const Spacer(),
              Pill(
                booking.status,
                color: statusColor.withValues(alpha: 0.14),
                textColor: statusColor,
              ),
              if (booking.isPending) ...[
                const SizedBox(width: 6),
                const SizedBox(
                  width: 13,
                  height: 13,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          Text(
            show?.movie?.title ?? 'Movie',
            style: const TextStyle(fontSize: 17.5, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(
                Icons.calendar_month_outlined,
                size: 15,
                color: AppColors.mutedForeground,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  '${formatShowTime(show?.startsAt)}'
                  '${theater != null ? '  ·  ${theater.name}, ${theater.city}' : ''}',
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.mutedForeground,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),
          Row(
            children: [
              const Icon(
                Icons.chair_outlined,
                size: 15,
                color: AppColors.mutedForeground,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  booking.seatLabels.isEmpty ? '—' : booking.seatLabels,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.mutedForeground,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text(
                formatMoney(booking.totalAmount),
                style: const TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(width: 8),
              Pill(
                'Payment: ${booking.paymentStatus}',
                color: AppColors.muted,
                textColor: AppColors.mutedForeground,
              ),
              const Spacer(),
              if (booking.status != 'CANCELLED')
                OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    side: BorderSide(
                      color: AppColors.danger.withValues(alpha: 0.45),
                    ),
                    minimumSize: const Size(0, 38),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                  ),
                  onPressed: canceling ? null : () => _cancel(booking),
                  child: canceling
                      ? const SizedBox(
                          width: 15,
                          height: 15,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.danger,
                          ),
                        )
                      : const Text('Cancel'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
