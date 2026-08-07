import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';

// Raise a quotation. A CLIENT requests one (their own contact pre-fills); staff
// start one for a client and capture the CLIENT's contact — never their own.
class NewQuotationScreen extends StatefulWidget {
  const NewQuotationScreen({super.key});
  @override
  State<NewQuotationScreen> createState() => _NewQuotationScreenState();
}

class _NewQuotationScreenState extends State<NewQuotationScreen> {
  final _clientName = TextEditingController();
  final _contactPerson = TextEditingController();
  final _contactEmail = TextEditingController();
  final _contactPhone = TextEditingController();
  final _subject = TextEditingController();
  final _requestNote = TextEditingController();
  bool _busy = false;

  bool get _isClient {
    final u = context.read<Session>().user;
    if (u == null) return false;
    final roles = u.roles.isNotEmpty ? u.roles : [u.role];
    return roles.length == 1 && roles.first == 'CLIENT';
  }

  @override
  void initState() {
    super.initState();
    // A client raising their own request pre-fills their own details.
    final u = context.read<Session>().user;
    if (_isClient && u != null) {
      _contactPerson.text = u.name;
      _contactEmail.text = u.email;
      if ((u.clientName ?? '').isNotEmpty) _clientName.text = u.clientName!;
    }
  }

  Future<void> _submit() async {
    if (!_isClient && _clientName.text.trim().isEmpty) return showError(context, 'Enter the client (company).');
    setState(() => _busy = true);
    try {
      await context.read<Session>().api.createQuotation({
        'clientName': _clientName.text.trim(),
        'contactPerson': _contactPerson.text.trim(),
        'contactEmail': _contactEmail.text.trim(),
        'contactPhone': _contactPhone.text.trim(),
        'subject': _subject.text.trim(),
        'requestNote': _requestNote.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_isClient ? 'Request sent' : 'Quotation created'), backgroundColor: kPass));
        Navigator.pop(context, true);
      }
    } catch (e) {
      showError(context, e.toString());
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isClient ? 'Request a quotation' : 'New quotation')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text(
          _isClient
              ? 'Tell us what you would like priced. Our team will prepare a quotation and send it back to you here.'
              : "Start a quotation for a client, then add line items and issue it on the next screen.",
          style: const TextStyle(color: kMute, fontSize: 13),
        ),
        const SectionBar('Details'),
        if (!_isClient) _field('Client name (company)', _clientName, hint: 'e.g. Kapa Oil Refineries'),
        _field('Client contact person', _contactPerson, hint: 'e.g. Jane Doe'),
        _field('Client email', _contactEmail, hint: 'client@company.com', keyboard: TextInputType.emailAddress),
        _field('Client phone', _contactPhone, hint: '+254 7XX XXX XXX', keyboard: TextInputType.phone),
        if (!_isClient) _field('Subject / job', _subject, hint: 'e.g. Calibration & verification of weighbridge'),
        if (_isClient) _field('What would you like quoted?', _requestNote, lines: 4),
        const SizedBox(height: 18),
        ElevatedButton(
          onPressed: _busy ? null : _submit,
          child: _busy
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: kCoal))
              : Text(_isClient ? 'Send request' : 'Create'),
        ),
        const SizedBox(height: 30),
      ]),
    );
  }

  Widget _field(String label, TextEditingController c, {String? hint, int lines = 1, TextInputType? keyboard}) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kMute)),
          const SizedBox(height: 4),
          TextField(controller: c, minLines: lines, maxLines: lines, keyboardType: keyboard, decoration: InputDecoration(hintText: hint)),
        ]),
      );
}
