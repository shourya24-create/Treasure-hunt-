/// core/models/chapter.dart — Echo's chapters and the reward that plays after a completion.
///
/// Chapters are keyed by step, never by checkpoint (GAMEPLAY.md §3).
library;

/// Content the story/AR team has not delivered yet is a `TODO_*` string.
bool isPlaceholder(String value) => value.isEmpty || value.startsWith('TODO_');

Map<String, dynamic>? asMap(Object? value) =>
    value is Map ? Map<String, dynamic>.from(value) : null;

class ChapterView {
  const ChapterView({
    required this.n,
    required this.title,
    required this.transcript,
    required this.audioUrl,
  });

  final int n;
  final String title;
  final String transcript;
  final String audioUrl;

  factory ChapterView.fromMap(Map<String, dynamic> m) => ChapterView(
        n: (m['n'] as num).toInt(),
        title: m['title'] as String? ?? '',
        transcript: m['transcript'] as String? ?? '',
        audioUrl: m['audioUrl'] as String? ?? '',
      );
}

/// Short audio/text tied to a checkpoint ("Wires cut. Signal clear.").
class ReactionView {
  const ReactionView({required this.text, required this.audioUrl});
  final String text;
  final String audioUrl;

  static ReactionView? fromMap(Map<String, dynamic>? m) => m == null
      ? null
      : ReactionView(
          text: m['text'] as String? ?? '',
          audioUrl: m['audioUrl'] as String? ?? '',
        );
}

/// Still to be played: the station reaction (skipped after CP1), then the chapter.
class PendingReward {
  const PendingReward({required this.chapter, this.stationReaction});
  final ReactionView? stationReaction;
  final ChapterView chapter;

  static PendingReward? fromMap(Map<String, dynamic>? m) {
    final chapter = asMap(m?['chapter']);
    if (m == null || chapter == null) return null;
    return PendingReward(
      stationReaction: ReactionView.fromMap(asMap(m['stationReaction'])),
      chapter: ChapterView.fromMap(chapter),
    );
  }
}
