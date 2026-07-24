import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme.dart';
import 'common.dart';

// Shared "mission control" scenery: a starfield backdrop and the QSL badge
// floating gently up and down on a little thruster flame. Used by the
// onboarding (Get Started) page and the login header so the whole entry flow
// feels like one scene.

class Starfield extends StatelessWidget {
  final int stars;
  const Starfield({super.key, this.stars = 70});
  @override
  Widget build(BuildContext context) => CustomPaint(painter: _StarPainter(stars), size: Size.infinite);
}

class _StarPainter extends CustomPainter {
  final int count;
  _StarPainter(this.count);
  @override
  void paint(Canvas canvas, Size size) {
    final rnd = math.Random(7); // fixed seed → stable sky
    final paint = Paint();
    for (var i = 0; i < count; i++) {
      paint.color = Colors.white.withOpacity(rnd.nextDouble() * 0.65 + 0.12);
      canvas.drawCircle(
        Offset(rnd.nextDouble() * size.width, rnd.nextDouble() * size.height),
        rnd.nextDouble() * 1.5 + 0.4,
        paint,
      );
    }
    final gold = Paint()..color = kGold.withOpacity(0.8);
    for (var i = 0; i < 6; i++) {
      canvas.drawCircle(
        Offset(rnd.nextDouble() * size.width, rnd.nextDouble() * size.height),
        rnd.nextDouble() * 1.3 + 0.6,
        gold,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _StarPainter old) => old.count != count;
}

// The QSL badge as a little astronaut: bobs up and down forever, glows gold,
// and (optionally) rides a flickering thruster flame.
class FloatingBadge extends StatefulWidget {
  final double size;
  final bool thruster;
  const FloatingBadge({super.key, this.size = 96, this.thruster = true});
  @override
  State<FloatingBadge> createState() => _FloatingBadgeState();
}

class _FloatingBadgeState extends State<FloatingBadge> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1900))..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final t = Curves.easeInOut.transform(_c.value);
        final dy = (t - 0.5) * 22; // ±11 px bob
        final flick = 0.55 + 0.45 * math.sin(_c.value * math.pi * 6).abs();
        return Transform.translate(
          offset: Offset(0, dy),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              padding: EdgeInsets.all(widget.size * 0.22),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: kGold.withOpacity(0.35), blurRadius: 46, spreadRadius: 4)],
              ),
              child: LogoMark(size: widget.size),
            ),
            if (widget.thruster) ...[
              const SizedBox(height: 8),
              Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _flameBar(16 * flick),
                  const SizedBox(width: 4),
                  _flameBar(30 * flick),
                  const SizedBox(width: 4),
                  _flameBar(16 * flick),
                ],
              ),
            ],
          ]),
        );
      },
    );
  }

  Widget _flameBar(double h) => Container(
        width: 5,
        height: h + 5,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(4),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [kGold, Color(0xFFE2571F), Colors.transparent],
          ),
        ),
      );
}
