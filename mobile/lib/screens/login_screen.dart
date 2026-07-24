import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/space_scene.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _obscure = true;
  String? _err;

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() {
      _err = null;
      _busy = true;
    });
    try {
      await context.read<Session>().login(_email.text.trim(), _password.text);
    } catch (e) {
      setState(() => _err = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final topH = MediaQuery.of(context).size.height * 0.36;
    return Scaffold(
      backgroundColor: kBg,
      resizeToAvoidBottomInset: true,
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Branded header — the same starfield scene as the welcome page,
            // with the badge bobbing gently above the wordmark.
            Container(
              height: topH,
              width: double.infinity,
              clipBehavior: Clip.antiAlias,
              decoration: const BoxDecoration(
                gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF2A241C), kCoal]),
                borderRadius: BorderRadius.only(bottomLeft: Radius.circular(34), bottomRight: Radius.circular(34)),
              ),
              child: Stack(fit: StackFit.expand, children: [
                const Starfield(stars: 55),
                SafeArea(
                  bottom: false,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const FloatingBadge(size: 58, thruster: false),
                        const SizedBox(height: 14),
                        const Text.rich(
                          TextSpan(children: [
                            TextSpan(text: 'QALIBRATED ', style: TextStyle(color: Colors.white)),
                            TextSpan(text: 'SYSTEMS', style: TextStyle(color: kGold)),
                          ]),
                          style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                        ),
                      ],
                    ),
                  ),
                ),
              ]),
            ),

            // Form
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 26, 22, 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Welcome back', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: kInk)),
                  const SizedBox(height: 4),
                  const Text('Sign in to continue', style: TextStyle(color: kMute, fontSize: 14)),
                  const SizedBox(height: 22),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(hintText: 'Email', prefixIcon: Icon(Icons.mail_outline, color: kMute)),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _password,
                    obscureText: _obscure,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _busy ? null : _submit(),
                    decoration: InputDecoration(
                      hintText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline, color: kMute),
                      suffixIcon: IconButton(
                        icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: kMute),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                  ),
                  if (_err != null) ...[
                    const SizedBox(height: 14),
                    Row(children: [
                      const Icon(Icons.error_outline, color: kFail, size: 18),
                      const SizedBox(width: 6),
                      Expanded(child: Text(_err!, style: const TextStyle(color: kFail, fontWeight: FontWeight.w600, fontSize: 13))),
                    ]),
                  ],
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _busy ? null : _submit,
                    child: _busy
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: kCoal))
                        : const Text('Sign in'),
                  ),
                  const SizedBox(height: 24),
                  const Center(
                    child: Text('Qalibrated Systems Ltd · KENAS ISO/IEC 17025', style: TextStyle(color: kMute, fontSize: 11)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
