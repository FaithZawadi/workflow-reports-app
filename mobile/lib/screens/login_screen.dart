import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _url = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _obscure = true;
  String? _err;

  @override
  void initState() {
    super.initState();
    _url.text = context.read<Session>().baseUrl;
  }

  Future<void> _submit() async {
    setState(() {
      _err = null;
      _busy = true;
    });
    try {
      await context.read<Session>().login(_url.text, _email.text, _password.text);
    } catch (e) {
      setState(() => _err = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(22),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                    const Align(alignment: Alignment.centerLeft, child: Brand()),
                    const SizedBox(height: 18),
                    const Text('Sign in', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: kInk)),
                    const SizedBox(height: 4),
                    const Text('Maintenance Management System — weighbridge reports, approvals and calibration records.',
                        style: TextStyle(color: kMute, fontSize: 13)),
                    const SizedBox(height: 18),
                    _label('Server'),
                    TextField(controller: _url, keyboardType: TextInputType.url, autocorrect: false,
                        decoration: const InputDecoration(hintText: 'https://reports.qalibrated.com')),
                    const SizedBox(height: 12),
                    _label('Email'),
                    TextField(controller: _email, keyboardType: TextInputType.emailAddress, autocorrect: false,
                        decoration: const InputDecoration(hintText: 'you@company.com')),
                    const SizedBox(height: 12),
                    _label('Password'),
                    TextField(
                      controller: _password,
                      obscureText: _obscure,
                      onSubmitted: (_) => _busy ? null : _submit(),
                      decoration: InputDecoration(
                        suffixIcon: IconButton(
                          icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: kMute),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                    ),
                    if (_err != null) ...[
                      const SizedBox(height: 12),
                      Text(_err!, style: const TextStyle(color: kFail, fontWeight: FontWeight.w700, fontSize: 13)),
                    ],
                    const SizedBox(height: 18),
                    ElevatedButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: kCoal))
                          : const Text('Sign in'),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Text(t, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kMute)),
      );
}
