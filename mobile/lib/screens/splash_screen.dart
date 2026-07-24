import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme.dart';
import '../widgets/common.dart';

// Cinematic launch splash (~2.6s), styled after 3D space app intros:
//  1. A dark sky where stars twinkle in, while a glowing orange planet horizon
//     rises from the bottom of the screen.
//  2. The QSL badge blasts up from below the horizon on a flickering thruster,
//     overshoots, then settles into a gentle zero-gravity hover.
//  3. The wordmark and tagline drift up, with a soft loader beneath.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 2600))..forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  double _clamp01(double v) => v.clamp(0.0, 1.0).toDouble();

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return Scaffold(
      body: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = _c.value;
          // Planet rises during the first 40%, then holds.
          final planetT = Curves.easeOutCubic.transform(_clamp01(t / 0.40));
          // Badge launches between 12% and 55% with a springy arrival.
          final rise = Curves.easeOutBack.transform(_clamp01((t - 0.12) / 0.43));
          final badgeY = (1 - rise) * (size.height * 0.42);
          final badgeOp = _clamp01((t - 0.10) / 0.16);
          // Thruster burns through the ascent, then cuts out.
          final thrust = t < 0.60 ? (1 - _clamp01((t - 0.12) / 0.48)) : 0.0;
          final flicker = 0.55 + 0.45 * math.sin(t * 52).abs();
          // Zero-g hover once arrived.
          final bob = t > 0.60 ? math.sin((t - 0.60) * 12) * 4.0 : 0.0;
          final tilt = t < 0.55 ? math.sin(t * 18) * 0.03 : 0.0;
          // Text reveal in the last 40%.
          final textT = Curves.easeOut.transform(_clamp01((t - 0.58) / 0.34));

          return Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFF17130E), Color(0xFF241D14)],
              ),
            ),
            child: Stack(fit: StackFit.expand, children: [
              // Twinkling stars.
              CustomPaint(painter: _TwinklePainter(t)),

              // The glowing planet horizon, rising into frame.
              Positioned(
                bottom: -size.width * 0.95 + planetT * size.width * 0.28,
                left: -size.width * 0.25,
                right: -size.width * 0.25,
                child: Opacity(
                  opacity: _clamp01(planetT * 1.2),
                  child: Container(
                    height: size.width * 1.5,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const RadialGradient(
                        center: Alignment(0, -0.55),
                        radius: 0.9,
                        colors: [Color(0xFF4A3418), Color(0xFF2A2013), Color(0xFF1D1710)],
                      ),
                      boxShadow: [
                        BoxShadow(color: const Color(0xFFE2571F).withOpacity(0.5 * planetT), blurRadius: 110, spreadRadius: 6),
                        BoxShadow(color: kGold.withOpacity(0.35 * planetT), blurRadius: 60, spreadRadius: 2),
                      ],
                    ),
                  ),
                ),
              ),

              // The launching badge + wordmark column.
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Transform.translate(
                      offset: Offset(0, badgeY + bob - 30),
                      child: Transform.rotate(
                        angle: tilt,
                        child: Opacity(
                          opacity: badgeOp,
                          child: Column(mainAxisSize: MainAxisSize.min, children: [
                            Container(
                              padding: const EdgeInsets.all(22),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                boxShadow: [BoxShadow(color: kGold.withOpacity(0.30 + 0.30 * thrust), blurRadius: 48, spreadRadius: 5)],
                              ),
                              child: const LogoMark(size: 84),
                            ),
                            SizedBox(height: 8 * thrust + 2),
                            Opacity(
                              opacity: thrust,
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _flame(18 * flicker * thrust),
                                  const SizedBox(width: 4),
                                  _flame(40 * flicker * thrust),
                                  const SizedBox(width: 4),
                                  _flame(18 * flicker * thrust),
                                ],
                              ),
                            ),
                          ]),
                        ),
                      ),
                    ),
                    const SizedBox(height: 26),
                    Opacity(
                      opacity: textT,
                      child: Transform.translate(
                        offset: Offset(0, (1 - textT) * 18),
                        child: Column(children: const [
                          Text.rich(
                            TextSpan(children: [
                              TextSpan(text: 'QALIBRATED ', style: TextStyle(color: Colors.white)),
                              TextSpan(text: 'SYSTEMS', style: TextStyle(color: kGold)),
                            ]),
                            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: 1),
                          ),
                          SizedBox(height: 8),
                          Text('CLEARED FOR TAKE-OFF', style: TextStyle(color: Color(0xFFB9B0A0), fontSize: 11, letterSpacing: 3)),
                        ]),
                      ),
                    ),
                    const SizedBox(height: 34),
                    Opacity(
                      opacity: textT,
                      child: const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.4, color: kGold)),
                    ),
                  ],
                ),
              ),
            ]),
          );
        },
      ),
    );
  }

  Widget _flame(double h) => Container(
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

// Stars that fade in with the scene and keep twinkling — each has a stable
// position (seeded RNG) and its own phase.
class _TwinklePainter extends CustomPainter {
  final double t;
  _TwinklePainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    final rnd = math.Random(11);
    final paint = Paint();
    for (var i = 0; i < 80; i++) {
      final dx = rnd.nextDouble() * size.width;
      final dy = rnd.nextDouble() * size.height * 0.85;
      final r = rnd.nextDouble() * 1.5 + 0.4;
      final phase = rnd.nextDouble() * math.pi * 2;
      final appear = ((t * 3) - rnd.nextDouble()).clamp(0.0, 1.0);
      final twinkle = 0.55 + 0.45 * math.sin(t * math.pi * 6 + phase);
      final gold = i % 11 == 0;
      paint.color = (gold ? kGold : Colors.white).withOpacity((rnd.nextDouble() * 0.55 + 0.2) * twinkle * appear);
      canvas.drawCircle(Offset(dx, dy), r, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _TwinklePainter old) => old.t != t;
}
