/// core/models/checkpoint.dart — What a player may see of a checkpoint, and
/// where checkpoints are for the admin map.
library;

/// A picture or description of the next checkpoint's scan object.
class ObjectHintView {
  const ObjectHintView({required this.text, required this.imageUrl});
  final String text;
  final String imageUrl;

  static ObjectHintView? fromMap(Map<String, dynamic>? m) => m == null
      ? null
      : ObjectHintView(
          text: m['text'] as String? ?? '',
          imageUrl: m['imageUrl'] as String? ?? '',
        );
}

/// A point on the admin map.
class MapPoint {
  const MapPoint(this.lat, this.lng);
  final double lat;
  final double lng;
}

/// Where the admin map opens. Taken from the campus centre already used by
/// the website's settings; change it if the event moves.
const campusCenter = MapPoint(19.0728, 72.8998);

/// TODO(club): the club chooses which real location gets which number
/// (GAMEPLAY.md §5.1). Fill these in once that is decided; until then the map
/// shows team pins only.
const Map<String, MapPoint?> checkpointLocations = {
  'BASE': null,
  'CP2': null,
  'CP3': null,
  'CP4': null,
  'CP5': null,
  'CP6': null,
  'CP7': null,
  'CP8': null,
};
