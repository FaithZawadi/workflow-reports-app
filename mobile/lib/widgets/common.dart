import 'package:flutter/material.dart';
import '../theme.dart';

// The wordmark, mirroring the web brand lockup.
class Brand extends StatelessWidget {
  final bool onDark;
  const Brand({super.key, this.onDark = false});
  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), border: Border.all(color: kLine)),
        alignment: Alignment.center,
        child: const Text('Q', style: TextStyle(fontWeight: FontWeight.w900, color: kCoal, fontSize: 18)),
      ),
      const SizedBox(width: 8),
      Text.rich(TextSpan(children: [
        TextSpan(text: 'QALIBRATED ', style: TextStyle(fontWeight: FontWeight.w900, color: onDark ? Colors.white : kCoal, letterSpacing: -0.2)),
        const TextSpan(text: 'SYSTEMS', style: TextStyle(fontWeight: FontWeight.w900, color: kGold, letterSpacing: 1.2)),
      ]), style: const TextStyle(fontSize: 15)),
    ]);
  }
}

class StatusPill extends StatelessWidget {
  final String status;
  const StatusPill(this.status, {super.key});
  @override
  Widget build(BuildContext context) {
    final color = kStatusColor[status] ?? kMute;
    final label = kStatusLabel[status] ?? status;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
      child: Text(label.toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.3)),
    );
  }
}

class Serial extends StatelessWidget {
  final String serial;
  const Serial(this.serial, {super.key});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      color: kCoal,
      child: Text(serial, style: const TextStyle(color: kGold, fontFamily: 'monospace', fontSize: 12, fontWeight: FontWeight.w700)),
    );
  }
}

// A small gold-swatch section header, mirroring the web SectionBar.
class SectionBar extends StatelessWidget {
  final String title;
  const SectionBar(this.title, {super.key});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 8),
      child: Row(children: [
        Container(width: 10, height: 10, color: kGold),
        const SizedBox(width: 6),
        Text(title.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: kInk, letterSpacing: 0.3)),
      ]),
    );
  }
}

void showError(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), backgroundColor: kFail));
}
