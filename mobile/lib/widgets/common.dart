import 'package:flutter/material.dart';
import '../theme.dart';

// The real QSL logo lockup. On dark surfaces it sits on a white pill so the
// colour artwork reads.
class Brand extends StatelessWidget {
  final bool onDark;
  final double height;
  const Brand({super.key, this.onDark = false, this.height = 26});
  @override
  Widget build(BuildContext context) {
    final img = Image.asset('assets/brand/logo.png', height: height, filterQuality: FilterQuality.high);
    if (!onDark) return img;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)),
      child: img,
    );
  }
}

// Just the circular QSL mark (for the splash / avatars).
class LogoMark extends StatelessWidget {
  final double size;
  const LogoMark({super.key, this.size = 96});
  @override
  Widget build(BuildContext context) => Image.asset('assets/brand/mark.png', width: size, height: size, filterQuality: FilterQuality.high);
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
      child: Text(
        serial,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(color: kGold, fontFamily: 'monospace', fontSize: 12, fontWeight: FontWeight.w700),
      ),
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
