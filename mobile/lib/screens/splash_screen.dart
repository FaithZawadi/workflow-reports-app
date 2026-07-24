import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme.dart';
import '../widgets/common.dart';

// A playful launch splash: the QSL badge blasts up like a little rocket on a
// trail of gold thruster streaks, sparkles pop around it, then the wordmark and
// a friendly tagline slide in. Runs about 2 seconds while the session restores.
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
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 2000))..forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  double _clamp01(double v) => v.clamp(0.0, 1.0).toDouble();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF2A241C), kCoal]),
        ),
        child: AnimatedBuilder(
          animation: _c,
          builder: (context, _) {
            final t = _c.value;
            // Launch: badge rises from below with a springy overshoot in the first 45%.
            final rise = Curves.easeOutBack.transform(_clamp01(t / 0.45));
            final badgeY = (1 - rise) * 96.0;
            final badgeOp = _clamp01(t / 0.22);
            // Thruster is strong during lift-off, then cuts out.
            final thrust = t < 0.5 ? (1 - _clamp01(t / 0.5)) : 0.0;
            final flicker = 0.6 + 0.4 * math.sin(t * 46).abs();
            // Gentle hover bob once it has arrived.
            final bob = t > 0.5 ? math.sin((t - 0.5) * 10) * 3.0 : 0.0;
            // Wordmark + tagline drift up in the back half.
            final textT = Curves.easeOut.transform(_clamp01((t - 0.45) / 0.45));

            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    height: 190,
                    width: 220,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        // Thruster streaks under the badge.
                        Positioned(
                          bottom: 8,
                          child: Opacity(
                            opacity: thrust,
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: List.generate(5, (i) {
                                final mid = (i - 2).abs();
                                final h = (60 - mid * 14) * flicker * thrust + 6;
                                return Container(
                                  width: 5,
                                  height: h,
                                  margin: const EdgeInsets.symmetric(horizontal: 3),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(4),
                                    gradient: const LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [kGold, Color(0xFFE2571F), Colors.transparent],
                                    ),
                                  ),
                                );
                              }),
                            ),
                          ),
                        ),
                        // Sparkles popping around the badge.
                        ..._sparkles(t),
                        // The rising, bobbing badge.
                        Transform.translate(
                          offset: Offset(0, badgeY + bob),
                          child: Opacity(
                            opacity: badgeOp,
                            child: Container(
                              padding: const EdgeInsets.all(22),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                boxShadow: [BoxShadow(color: kGold.withOpacity(0.30 + 0.25 * thrust), blurRadius: 44, spreadRadius: 4)],
                              ),
                              child: const LogoMark(size: 84),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  Opacity(
                    opacity: textT,
                    child: Transform.translate(
                      offset: Offset(0, (1 - textT) * 16),
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
            );
          },
        ),
      ),
    );
  }

  // Six sparkles that pop (scale up then fade) at staggered moments around the badge.
  List<Widget> _sparkles(double t) {
    const spots = [
      [22.0, 30.0, 16.0, 0.30],
      [180.0, 34.0, 12.0, 0.42],
      [8.0, 96.0, 13.0, 0.50],
      [196.0, 92.0, 18.0, 0.36],
      [40.0, 150.0, 11.0, 0.58],
      [172.0, 150.0, 14.0, 0.64],
    ];
    return spots.map((s) {
      final delay = s[3];
      final local = _clamp01((t - delay) / 0.28);
      final scale = local == 0 ? 0.0 : math.sin(local * math.pi); // pop up then down
      return Positioned(
        left: s[0],
        top: s[1],
        child: Transform.scale(
          scale: scale,
          child: Icon(Icons.auto_awesome, size: s[2], color: kGold.withOpacity(0.9)),
        ),
      );
    }).toList();
  }
}
