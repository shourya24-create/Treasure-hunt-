/// player/home/home_content.dart — The words on the Home tab.
///
/// DRAFT COPY: written from GAMEPLAY.md so the screen can be built and
/// rehearsed. The story team should replace it with the final wording. It
/// must never name a place, a checkpoint or the final decision.
library;

class HomeStep {
  const HomeStep(this.title, this.text);
  final String title;
  final String text;
}

class HomeContent {
  HomeContent._();

  static const title = 'The Echo Protocol';

  static const story = [
    'A signal has been found on this campus. It calls itself Echo.',
    'Echo is broken into eight fragments. Each one holds a part of what it is '
        'trying to say. The first is in this room. The other seven are hidden '
        'across the campus.',
    'Recover every fragment, listen to what Echo tells you, and bring it back '
        'here. At the end your team has one decision to make.',
  ];

  static const steps = [
    HomeStep(
      'Start',
      'Solve the paper puzzle in the starting room. A club member gives your '
          'team an access code. Enter it to recover Fragment 1.',
    ),
    HomeStep(
      'Find',
      'Open FRAGMENTS to read your clue and see the object to look for. '
          'Walk there as a team.',
    ),
    HomeStep(
      'Scan',
      'Tap SCAN and point the camera at the object. If it is your signal, '
          'the fragment opens.',
    ),
    HomeStep(
      'Solve',
      'Finish the AR activity at that spot. Echo speaks, and the clue to '
          'your next fragment appears.',
    ),
    HomeStep(
      'Return',
      'After the last fragment, come back to the starting room for Echo\'s '
          'final message and your decision.',
    ),
  ];

  static const rules = [
    'You have 2 hours from the moment the game starts.',
    'One phone plays for your team. Keep it charged and keep it with you.',
    'Fragments open one at a time. Every team has its own order, so do not '
        'follow another team.',
    'Keep location on. If you are lost, hurt or stuck, use I NEED HELP in '
        'PROFILE.',
    'Everything Echo has told you is saved in ARCHIVE.',
  ];
}
