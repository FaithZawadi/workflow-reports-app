import 'package:flutter/material.dart';
import '../theme.dart';
import '../widgets/space_scene.dart';

// The "Get Started" welcome page shown before login: a dark starfield, the QSL
// badge bobbing gently on its thruster (our astronaut), a bold two-tone
// headline and a single Get Started button — mirroring the web brand.
class OnboardingScreen extends StatelessWidget {
  final VoidCallback onStart;
  const OnboardingScreen({super.key, required this.onStart});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF221D16), kCoal]),
        ),
        child: Stack(fit: StackFit.expand, children: [
          const Starfield(stars: 90),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 26),
              child: Column(children: [
                const Spacer(flex: 2),
                const FloatingBadge(size: 100),
                const Spacer(flex: 2),
                const Text(
                  'Weighbridge Care',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900, height: 1.1),
                ),
                const Text(
                  'Made Simple',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: kGold, fontSize: 32, fontWeight: FontWeight.w900, height: 1.15),
                ),
                const SizedBox(height: 14),
                const Text(
                  'File, review and approve maintenance reports from anywhere — your weighbridges, in your pocket.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFFB9B0A0), fontSize: 14.5, height: 1.45),
                ),
                const Spacer(flex: 2),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(onPressed: onStart, child: const Text('Get Started')),
                ),
                const SizedBox(height: 14),
                const Text('Qalibrated Systems Ltd · KENAS ISO/IEC 17025', style: TextStyle(color: Color(0xFF7A7264), fontSize: 11)),
                const SizedBox(height: 18),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}
