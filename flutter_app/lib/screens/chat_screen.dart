import 'dart:convert';

import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

class _ToolRun {
  _ToolRun({required this.name, this.args, this.result, this.done = false});

  final String name;
  dynamic args;
  dynamic result;
  bool done;
}

class _ChatTurn {
  _ChatTurn({
    required this.sender, // 'user' | 'assistant'
    this.content = '',
    this.streaming = false,
  });

  final String sender;
  String content;
  String? mode;
  bool streaming;
  final List<_ToolRun> tools = [];
}

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _api = ApiClient.instance;
  final _input = TextEditingController();
  final _scroll = ScrollController();

  final List<_ChatTurn> _turns = [];
  String? _conversationId;
  bool _sending = false;
  String? _error;

  static const _presets = [
    'Find sci-fi shows this weekend in recliner seats',
    'Pick the best movie for a tense but beautiful night',
    'Show my pending tickets and payment status',
  ];

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  String _toolName(Map tool) =>
      (tool['toolName'] ?? tool['name'] ?? 'tool').toString();

  Future<void> _send([String? preset]) async {
    final text = (preset ?? _input.text).trim();
    if (text.isEmpty || _sending) return;

    final assistantTurn = _ChatTurn(sender: 'assistant', streaming: true);
    setState(() {
      _error = null;
      _sending = true;
      _turns.add(_ChatTurn(sender: 'user', content: text));
      _turns.add(assistantTurn);
      _input.clear();
    });
    _scrollToBottom();

    try {
      await _streamReply(text, assistantTurn);
    } catch (_) {
      // Streaming failed — fall back to the non-streaming endpoint.
      try {
        await _plainReply(text, assistantTurn);
      } catch (e) {
        setState(() {
          _turns.remove(assistantTurn);
          _error = e.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          assistantTurn.streaming = false;
          _sending = false;
        });
        _scrollToBottom();
      }
    }
  }

  Future<void> _streamReply(String text, _ChatTurn turn) async {
    final stream = _api.postStream('/chat/messages/stream', {
      if (_conversationId != null) 'conversationId': _conversationId,
      'message': text,
    });
    await for (final event in stream) {
      if (!mounted) return;
      final type = event['type'] as String?;
      if (type == 'error') {
        throw ApiException(
          (event['message'] as String?) ?? 'Chat stream failed',
        );
      }
      setState(() {
        switch (type) {
          case 'conversation':
            _conversationId =
                event['conversationId'] as String? ?? _conversationId;
          case 'assistant_mode':
            turn.mode = event['assistantMode'] as String?;
          case 'tool_start':
            final tool = event['tool'];
            if (tool is Map) {
              turn.tools.add(
                _ToolRun(
                  name: _toolName(tool),
                  args: tool['args'] ?? tool['input'],
                ),
              );
            }
          case 'tool_result':
            final tool = event['tool'];
            if (tool is Map) {
              final name = _toolName(tool);
              final open = turn.tools
                  .where((t) => !t.done && t.name == name)
                  .toList();
              final target = open.isNotEmpty
                  ? open.last
                  : (turn.tools.where((t) => !t.done).isNotEmpty
                        ? turn.tools.lastWhere((t) => !t.done)
                        : null);
              if (target != null) {
                target.result = tool['result'] ?? tool['output'];
                target.args = target.args ?? tool['args'];
                target.done = true;
              } else {
                turn.tools.add(
                  _ToolRun(
                    name: name,
                    args: tool['args'],
                    result: tool['result'],
                    done: true,
                  ),
                );
              }
            }
          case 'message_delta':
            turn.content += (event['delta'] as String?) ?? '';
          case 'message_done':
            final message = event['message'] as String?;
            if (message != null && message.isNotEmpty) turn.content = message;
            _conversationId =
                event['conversationId'] as String? ?? _conversationId;
            turn.mode = event['assistantMode'] as String? ?? turn.mode;
            for (final t in turn.tools) {
              t.done = true;
            }
        }
      });
      _scrollToBottom();
    }
    if (turn.content.isEmpty && turn.tools.isEmpty) {
      throw ApiException('Empty stream');
    }
  }

  Future<void> _plainReply(String text, _ChatTurn turn) async {
    final data = await _api.post('/chat/messages', {
      if (_conversationId != null) 'conversationId': _conversationId,
      'message': text,
    });
    if (!mounted) return;
    setState(() {
      _conversationId = data['conversationId'] as String? ?? _conversationId;
      turn.content = (data['message'] as String?) ?? '';
      turn.mode = data['assistantMode'] as String?;
      turn.tools.clear();
      for (final tool in (data['tools'] as List?) ?? const []) {
        if (tool is Map) {
          turn.tools.add(
            _ToolRun(
              name: _toolName(tool),
              args: tool['args'],
              result: tool['result'],
              done: true,
            ),
          );
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.accent.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: const Icon(
                    Icons.smart_toy_outlined,
                    size: 20,
                    color: AppColors.inkDeep,
                  ),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'CineBook concierge',
                        style: TextStyle(
                          fontSize: 16.5,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        'Books seats and shows its work',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.mutedForeground,
                        ),
                      ),
                    ],
                  ),
                ),
                Pill(
                  _sending ? 'Streaming' : 'Ready',
                  color: _sending
                      ? AppColors.accent.withValues(alpha: 0.2)
                      : AppColors.muted,
                  textColor: AppColors.ink,
                  icon: _sending ? Icons.bolt : Icons.check_circle_outline,
                ),
              ],
            ),
          ),
          SizedBox(
            height: 38,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _presets.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, i) => ActionChip(
                label: Text(_presets[i], style: const TextStyle(fontSize: 12)),
                onPressed: _sending ? null : () => _send(_presets[i]),
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: ErrorBanner(_error!),
            ),
          Expanded(
            child: _turns.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 36),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(
                            Icons.auto_awesome,
                            size: 34,
                            color: AppColors.mutedForeground,
                          ),
                          SizedBox(height: 10),
                          Text(
                            'What should we book?',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          SizedBox(height: 5),
                          Text(
                            'Ask for movies, seats, offers, or a full checkout — the agent shows every step.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13,
                              height: 1.45,
                              color: AppColors.mutedForeground,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.separated(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                    itemCount: _turns.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, i) => _turnBubble(_turns[i]),
                  ),
          ),
          Container(
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(
                top: BorderSide(color: AppColors.border, width: 0.8),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: _input,
                    minLines: 1,
                    maxLines: 4,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _send(),
                    decoration: const InputDecoration(
                      hintText: 'Ask for movies, seats, offers…',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 48,
                  height: 48,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      padding: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(13),
                      ),
                    ),
                    onPressed: _sending ? null : _send,
                    child: _sending
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.3,
                              color: AppColors.inkDeep,
                            ),
                          )
                        : const Icon(Icons.send_rounded, size: 20),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _turnBubble(_ChatTurn turn) {
    final isUser = turn.sender == 'user';
    if (isUser) {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 300),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: const BoxDecoration(
            color: AppColors.inkDeep,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(16),
              topRight: Radius.circular(16),
              bottomLeft: Radius.circular(16),
              bottomRight: Radius.circular(4),
            ),
          ),
          child: Text(
            turn.content,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              height: 1.4,
            ),
          ),
        ),
      );
    }

    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 330),
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(4),
            topRight: Radius.circular(16),
            bottomLeft: Radius.circular(16),
            bottomRight: Radius.circular(16),
          ),
          border: Border.all(color: AppColors.border, width: 0.8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.smart_toy_outlined,
                  size: 14,
                  color: AppColors.mutedForeground,
                ),
                const SizedBox(width: 5),
                Text(
                  turn.mode ?? 'assistant',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.mutedForeground,
                  ),
                ),
                const Spacer(),
                if (turn.streaming)
                  const Pill(
                    'Thinking',
                    color: AppColors.muted,
                    icon: Icons.bolt,
                  ),
              ],
            ),
            if (turn.tools.isNotEmpty) ...[
              const SizedBox(height: 8),
              for (var i = 0; i < turn.tools.length; i++)
                _toolTile(turn.tools[i], i + 1),
            ],
            if (turn.content.isNotEmpty || !turn.streaming) ...[
              const SizedBox(height: 8),
              Text(
                turn.content.isEmpty ? '…' : turn.content,
                style: const TextStyle(fontSize: 14, height: 1.45),
              ),
            ] else ...[
              const SizedBox(height: 10),
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _pretty(dynamic value) {
    if (value == null) return '—';
    String text;
    try {
      text = const JsonEncoder.withIndent('  ').convert(value);
    } catch (_) {
      text = value.toString();
    }
    return text.length > 900 ? '${text.substring(0, 900)}…' : text;
  }

  Widget _toolTile(_ToolRun tool, int step) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border, width: 0.7),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 10),
          childrenPadding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
          dense: true,
          leading: tool.done
              ? const Icon(
                  Icons.check_circle,
                  size: 17,
                  color: AppColors.success,
                )
              : const SizedBox(
                  width: 15,
                  height: 15,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
          title: Text(
            'Step $step: ${tool.name}',
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
          ),
          children: [
            _jsonPanel('Input', _pretty(tool.args)),
            const SizedBox(height: 6),
            _jsonPanel('Output', _pretty(tool.result)),
          ],
        ),
      ),
    );
  }

  Widget _jsonPanel(String label, String body) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: AppColors.inkDeep,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
              color: Colors.white.withValues(alpha: 0.55),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            body,
            style: const TextStyle(
              fontSize: 11,
              height: 1.4,
              color: Color(0xFFD9DEE9),
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}
