import 'package:flutter/material.dart';
import '../theme.dart';
import '../widgets/common.dart';

// Animated launch splash — the QSL mark fades + scales in on a dark brand
// gradient, with the wordmark and a subtle loader beneath.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _fade;
  late final Animation<double> _scale;
  late final Animation<double> _textFade;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..forward();
    _fade = CurvedAnimation(parent: _c, curve: const Interval(0.0, 0.5, curve: Curves.easeOut));
    _scale = Tween(begin: 0.72, end: 1.0).animate(CurvedAnimation(parent: _c, curve: const Interval(0.0, 0.7, curve: Curves.easeOutBack)));
    _textFade = CurvedAnimation(parent: _c, curve: const Interval(0.45, 1.0, curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF2A241C), kCoal]),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FadeTransition(
                opacity: _fade,
                child: ScaleTransition(
                  scale: _scale,
                  child: Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [BoxShadow(color: kGold.withOpacity(0.28), blurRadius: 44, spreadRadius: 4)],
                    ),
                    child: const LogoMark(size: 88),
                  ),
                ),
              ),
              const SizedBox(height: 26),
              FadeTransition(
                opacity: _textFade,
                child: Column(children: const [
                  Text.rich(
                    TextSpan(children: [
                      TextSpan(text: 'QALIBRATED ', style: TextStyle(color: Colors.white)),
                      TextSpan(text: 'SYSTEMS', style: TextStyle(color: kGold)),
                    ]),
                    style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900, letterSpacing: 1),
                  ),
                  SizedBox(height: 8),
                  Text('MAINTENANCE MANAGEMENT', style: TextStyle(color: Color(0xFFB9B0A0), fontSize: 11, letterSpacing: 3)),
                ]),
              ),
              const SizedBox(height: 40),
              const SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.4, color: kGold)),
            ],
          ),
        ),
      ),
    );
  }
}
