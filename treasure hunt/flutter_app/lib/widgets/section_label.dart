/// widgets/section_label.dart — Small all-caps Oswald label above a section.
library;

import 'package:flutter/material.dart';

import '../theme.dart';

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key, this.color = EchoColors.textSecondary});
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) =>
      Text(text.toUpperCase(), style: EchoText.label(color: color));
}
