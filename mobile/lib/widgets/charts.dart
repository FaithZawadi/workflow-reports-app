import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme.dart';

class Segment {
  final String label;
  final num value;
  final Color color;
  final VoidCallback? onTap;
  const Segment(this.label, this.value, this.color, {this.onTap});
}

// KPI tile.
class StatTile extends StatelessWidget {
  final String label;
  final String value;
  final String? sub;
  final Color tone;
  final String? icon;
  final VoidCallback? onTap;
  const StatTile({super.key, required this.label, required this.value, this.sub, this.tone = kInk, this.icon, this.onTap});
  @override
  Widget build(BuildContext context) {
    final card = Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(kRadius), boxShadow: kSoftShadow),
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Expanded(child: Text(label.toUpperCase(), style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: kMute, letterSpacing: 0.3))),
          if (icon != null) Text(icon!, style: const TextStyle(fontSize: 15)),
        ]),
        const SizedBox(height: 6),
        Text(value, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: tone, height: 1.05)),
        if (sub != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(sub!, style: const TextStyle(fontSize: 11.5, color: kMute))),
      ]),
    );
    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      child: InkWell(borderRadius: BorderRadius.circular(kRadius), onTap: onTap, child: card),
    );
  }
}

// Card wrapper for a chart.
class ChartCard extends StatelessWidget {
  final String title;
  final Widget child;
  const ChartCard({super.key, required this.title, required this.child});
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(kRadius), boxShadow: kSoftShadow),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Text(title.toUpperCase(), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: kInk, letterSpacing: 0.3)),
        const SizedBox(height: 12),
        child,
      ]),
    );
  }
}

// Donut with a legend.
class Donut extends StatelessWidget {
  final List<Segment> segments;
  final String centerLabel;
  const Donut({super.key, required this.segments, this.centerLabel = 'total'});
  @override
  Widget build(BuildContext context) {
    final total = segments.fold<num>(0, (a, s) => a + s.value);
    return Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
      SizedBox(
        width: 118,
        height: 118,
        child: CustomPaint(
          painter: _DonutPainter(segments, total.toDouble()),
          child: Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text('$total', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: kInk)),
              Text(centerLabel.toUpperCase(), style: const TextStyle(fontSize: 9, color: kMute)),
            ]),
          ),
        ),
      ),
      const SizedBox(width: 14),
      Expanded(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (final s in segments)
            InkWell(
              onTap: s.onTap,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 2),
                child: Row(children: [
                  Container(width: 11, height: 11, decoration: BoxDecoration(color: s.color, borderRadius: BorderRadius.circular(3))),
                  const SizedBox(width: 8),
                  Expanded(child: Text(s.label, style: const TextStyle(fontSize: 12.5, color: kInk))),
                  Text('${s.value}', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: kInk)),
                  if (s.onTap != null) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.chevron_right, size: 15, color: kMute)),
                ]),
              ),
            ),
        ]),
      ),
    ]);
  }
}

class _DonutPainter extends CustomPainter {
  final List<Segment> segments;
  final double total;
  _DonutPainter(this.segments, this.total);
  @override
  void paint(Canvas canvas, Size size) {
    final stroke = 20.0;
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: (size.width - stroke) / 2);
    final bg = Paint()..style = PaintingStyle.stroke..strokeWidth = stroke..color = kLine;
    canvas.drawArc(rect, 0, 2 * math.pi, false, bg);
    if (total <= 0) return;
    double start = -math.pi / 2;
    for (final s in segments) {
      if (s.value <= 0) continue;
      final sweep = (s.value / total) * 2 * math.pi;
      final p = Paint()..style = PaintingStyle.stroke..strokeWidth = stroke..strokeCap = StrokeCap.butt..color = s.color;
      canvas.drawArc(rect, start, sweep, false, p);
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter old) => old.total != total || old.segments != segments;
}

// Horizontal bar list.
class BarList extends StatelessWidget {
  final List<Segment> items;
  const BarList({super.key, required this.items});
  @override
  Widget build(BuildContext context) {
    final max = items.fold<num>(1, (a, s) => math.max(a, s.value));
    return Column(mainAxisSize: MainAxisSize.min, children: [
      for (final it in items)
        InkWell(
          onTap: it.onTap,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 2),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Expanded(child: Text(it.label, style: const TextStyle(fontSize: 12.5, color: kInk))),
                Text('${it.value}', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: kInk)),
              ]),
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: (it.value / max).clamp(0, 1).toDouble(),
                  minHeight: 8,
                  backgroundColor: const Color(0xFFEFEADD),
                  valueColor: AlwaysStoppedAnimation(it.color),
                ),
              ),
            ]),
          ),
        ),
    ]);
  }
}

// Trend sparkline (area + line).
class Trend extends StatelessWidget {
  final List<double> values;
  final Color color;
  const Trend({super.key, required this.values, this.color = kGold});
  @override
  Widget build(BuildContext context) {
    return SizedBox(height: 90, width: double.infinity, child: CustomPaint(painter: _TrendPainter(values, color)));
  }
}

class _TrendPainter extends CustomPainter {
  final List<double> v;
  final Color color;
  _TrendPainter(this.v, this.color);
  @override
  void paint(Canvas canvas, Size size) {
    if (v.isEmpty) return;
    final maxV = math.max(1.0, v.reduce(math.max));
    final n = v.length;
    double x(int i) => (i * size.width) / math.max(1, n - 1);
    double y(double val) => size.height - 6 - (val / maxV) * (size.height - 16);
    final path = Path();
    final area = Path();
    for (int i = 0; i < n; i++) {
      final px = x(i), py = y(v[i]);
      if (i == 0) {
        path.moveTo(px, py);
        area.moveTo(px, size.height);
        area.lineTo(px, py);
      } else {
        path.lineTo(px, py);
        area.lineTo(px, py);
      }
    }
    area.lineTo(x(n - 1), size.height);
    area.close();
    canvas.drawPath(area, Paint()..style = PaintingStyle.fill..color = color.withOpacity(0.20));
    canvas.drawPath(path, Paint()..style = PaintingStyle.stroke..strokeWidth = 2.5..strokeJoin = StrokeJoin.round..color = color);
  }

  @override
  bool shouldRepaint(covariant _TrendPainter old) => old.v != v;
}

// Semicircle gauge (0..max).
class Gauge extends StatelessWidget {
  final double value;
  final double max;
  final String? label;
  const Gauge({super.key, required this.value, this.max = 5, this.label});
  @override
  Widget build(BuildContext context) {
    final frac = (value / max).clamp(0, 1).toDouble();
    final color = frac >= 0.8 ? kPass : frac >= 0.5 ? kWait : kFail;
    return Column(mainAxisSize: MainAxisSize.min, children: [
      SizedBox(width: 170, height: 96, child: CustomPaint(
        painter: _GaugePainter(frac, color),
        child: Center(child: Padding(
          padding: const EdgeInsets.only(top: 26),
          child: Text(value > 0 ? value.toStringAsFixed(1) : '—', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: kInk)),
        )),
      )),
      if (label != null) Text(label!, style: const TextStyle(fontSize: 12, color: kMute)),
    ]);
  }
}

class _GaugePainter extends CustomPainter {
  final double frac;
  final Color color;
  _GaugePainter(this.frac, this.color);
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(10, 12, size.width - 20, (size.width - 20));
    final track = Paint()..style = PaintingStyle.stroke..strokeWidth = 13..strokeCap = StrokeCap.round..color = kLine;
    final fill = Paint()..style = PaintingStyle.stroke..strokeWidth = 13..strokeCap = StrokeCap.round..color = color;
    canvas.drawArc(rect, math.pi, math.pi, false, track);
    canvas.drawArc(rect, math.pi, math.pi * frac, false, fill);
  }

  @override
  bool shouldRepaint(covariant _GaugePainter old) => old.frac != frac;
}
