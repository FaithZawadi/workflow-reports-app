import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import '../session.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

class NewReportScreen extends StatefulWidget {
  const NewReportScreen({super.key});
  @override
  State<NewReportScreen> createState() => _NewReportScreenState();
}

class _NewReportScreenState extends State<NewReportScreen> {
  bool _loading = true;
  String? _loadErr;
  List<Map<String, dynamic>> _templates = [];
  List<Person> _supervisors = [], _managers = [];
  List<String> _clients = [];

  Map<String, dynamic>? _tpl; // chosen template

  // form state
  final _client = TextEditingController();
  final _site = TextEditingController();
  final _weighbridge = TextEditingController();
  String _supervisorEmail = '', _managerEmail = '';
  final Map<String, dynamic> _values = {};
  final Map<String, Map<String, dynamic>> _checks = {};
  final Map<String, dynamic> _grids = {};
  final Map<String, String> _runs = {};
  final List<Map<String, dynamic>> _photos = [];
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    final api = context.read<Session>().api;
    try {
      final t = await api.getTemplates();
      final allowed = ((t['allowed'] as List?) ?? []).map((e) => e.toString()).toSet();
      final all = ((t['templates'] as List?) ?? []).map((e) => Map<String, dynamic>.from(e)).toList();
      _templates = all.where((e) => allowed.contains(e['code'])).toList();
      final dir = await api.getDirectory();
      _supervisors = dir['supervisors'] ?? [];
      _managers = dir['managers'] ?? [];
      try { _clients = await api.getClients(); } catch (_) {}
      final u = context.read<Session>().user!;
      if (u.clientName != null) _client.text = u.clientName!;
    } catch (e) {
      _loadErr = e.toString();
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _submit() async {
    if (!RegExp(r'\S+@\S+\.\S+').hasMatch(_supervisorEmail)) return showError(context, "Choose the Equipment User's email.");
    if (!RegExp(r'\S+@\S+\.\S+').hasMatch(_managerEmail)) return showError(context, "Choose the Client/Manager's email.");
    if (_client.text.trim().isEmpty) return showError(context, 'Choose the client (plant).');
    setState(() => _busy = true);
    try {
      final serial = await context.read<Session>().api.submitReport({
        'template': _tpl!['code'],
        'weighbridgeId': _weighbridge.text.trim(),
        'clientName': _client.text.trim(),
        'site': _site.text.trim(),
        'supervisorEmail': _supervisorEmail.trim(),
        'managerEmail': _managerEmail.trim(),
        'values': _values,
        'checks': _checks,
        'grids': _grids,
        'runs': _runs,
        'photos': _photos,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Submitted $serial'), backgroundColor: kPass));
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
      appBar: AppBar(title: Text(_tpl == null ? 'New report' : '${_tpl!['name']}')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: kCoal))
          : _loadErr != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_loadErr!, style: const TextStyle(color: kFail))))
              : _tpl == null
                  ? _picker()
                  : _form(),
    );
  }

  Widget _picker() {
    return ListView(padding: const EdgeInsets.all(14), children: [
      const Text('Choose the sheet', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: kInk)),
      const SizedBox(height: 4),
      const Text('Pick what you are doing today.', style: TextStyle(color: kMute)),
      const SizedBox(height: 12),
      for (final t in _templates)
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Card(
            child: ListTile(
              title: Text('${t['name']}', style: const TextStyle(fontWeight: FontWeight.w900, color: kInk)),
              subtitle: Text('${t['desc'] ?? ''}\nFilled by: ${t['who'] ?? ''}', style: const TextStyle(color: kMute, fontSize: 12)),
              isThreeLine: true,
              trailing: Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3), color: kCoal, child: Text('${t['code']}', style: const TextStyle(color: kGold, fontFamily: 'monospace', fontSize: 11))),
              onTap: () => setState(() => _tpl = t),
            ),
          ),
        ),
    ]);
  }

  Widget _form() {
    final sections = (_tpl!['sections'] as List?) ?? [];
    return ListView(padding: const EdgeInsets.all(14), children: [
      const Text('Serial number is assigned when you submit.', style: TextStyle(color: kMute, fontSize: 12)),
      const SectionBar('Client & site'),
      _field('Client (plant)', _client),
      _field('Site / location of this job', _site),
      _field('Weighbridge', _weighbridge),

      for (int si = 0; si < sections.length; si++) ..._section(Map<String, dynamic>.from(sections[si]), si),

      const SectionBar('Photos'),
      _photosSection(),

      const SectionBar('Approval route'),
      _reviewerPicker('Equipment User (reviews first)', _supervisors, _supervisorEmail, (v) => setState(() => _supervisorEmail = v)),
      const SizedBox(height: 8),
      _reviewerPicker('Client/Manager (approves)', _managers, _managerEmail, (v) => setState(() => _managerEmail = v)),
      const SizedBox(height: 18),
      ElevatedButton(
        onPressed: _busy ? null : _submit,
        child: _busy ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: kCoal)) : const Text('Review & submit'),
      ),
      const SizedBox(height: 30),
    ]);
  }

  List<Widget> _section(Map<String, dynamic> sec, int si) {
    switch (sec['type']) {
      case 'fields':
        return [
          for (final f in (sec['fields'] as List? ?? []))
            _valField('${(f as Map)['label']}', '${f['k']}', number: f['inputType'] == 'number', date: f['inputType'] == 'date'),
        ];
      case 'textarea':
        return [SectionBar('${sec['label'] ?? ''}'), _valField('', '${sec['k']}', lines: 3)];
      case 'checklist':
        return [_checklist(sec, si)];
      case 'choices':
        return [_choices(sec)];
      case 'weekly':
        return [_weekly()];
      case 'rows':
        return [_rows(sec)];
      case 'loadcells':
        return [_loadcells()];
      default:
        return [];
    }
  }

  // ---- generic inputs ----
  Widget _field(String label, TextEditingController c) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kMute)),
          const SizedBox(height: 4),
          TextField(controller: c),
        ]),
      );

  Widget _valField(String label, String key, {bool number = false, bool date = false, int lines = 1}) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (label.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kMute))),
          TextField(
            keyboardType: number ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
            minLines: lines,
            maxLines: lines,
            onChanged: (v) => _values[key] = v,
            decoration: InputDecoration(hintText: date ? 'YYYY-MM-DD' : null),
          ),
        ]),
      );

  Widget _checklist(Map<String, dynamic> sec, int si) {
    final items = (sec['items'] as List?) ?? [];
    final states = (sec['states'] as List?) ??
        [
          {'key': 'ok', 'label': sec['yes'] ?? 'OK'},
          {'key': 'problem', 'label': sec['no'] ?? 'NEEDS ATTENTION'}
        ];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SectionBar('${sec['title'] ?? 'Checklist'}'),
      for (int ii = 0; ii < items.length; ii++)
        Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), border: Border.all(color: kLine)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${items[ii]}', style: const TextStyle(fontSize: 14, color: kInk)),
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final s in states.cast<Map>())
                _stateChip('$si:$ii', '${s['key']}', '${s['label']}'),
            ]),
            const SizedBox(height: 6),
            TextField(
              decoration: const InputDecoration(hintText: 'Remark (optional)', isDense: true),
              onChanged: (v) => (_checks['$si:$ii'] ??= {})['remark'] = v,
            ),
          ]),
        ),
    ]);
  }

  Widget _stateChip(String cell, String key, String label) {
    final selected = _checks[cell]?['state'] == key;
    final color = _colorForKey(key);
    return GestureDetector(
      onTap: () => setState(() => (_checks[cell] ??= {})['state'] = key),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(color: selected ? color : Colors.white, borderRadius: BorderRadius.circular(3), border: Border.all(color: selected ? color : const Color(0xFFCFC8BA))),
        child: Text(label, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: selected ? Colors.white : color)),
      ),
    );
  }

  Widget _choices(Map<String, dynamic> sec) {
    final options = (sec['options'] as List?) ?? [];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SectionBar('${sec['title'] ?? ''}'),
      for (final o in options)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: GestureDetector(
            onTap: () => setState(() => _values['${sec['k']}'] = o),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: _values['${sec['k']}'] == o ? kCoal : Colors.white, borderRadius: BorderRadius.circular(3), border: Border.all(color: _values['${sec['k']}'] == o ? kCoal : const Color(0xFFCFC8BA))),
              child: Text('$o', style: TextStyle(color: _values['${sec['k']}'] == o ? kGold : kInk, fontWeight: _values['${sec['k']}'] == o ? FontWeight.w700 : FontWeight.w400)),
            ),
          ),
        ),
    ]);
  }

  Widget _weekly() {
    Widget run(int r) => Row(children: [
          SizedBox(width: 48, child: Text('Run $r', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
          for (final p in const ['a', 'm', 'b'])
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: TextField(
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(labelText: p == 'a' ? 'End A' : (p == 'm' ? 'Middle' : 'End B'), isDense: true),
                  onChanged: (v) => _runs['$r$p'] = v,
                ),
              ),
            ),
        ]);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SectionBar('End — Middle — End test (same truck)'),
      run(1),
      const SizedBox(height: 8),
      run(2),
    ]);
  }

  Widget _rows(Map<String, dynamic> sec) {
    final cols = (sec['cols'] as List?) ?? [];
    final nRows = (sec['rows'] as int?) ?? 4;
    final key = '${sec['key']}';
    final prefill = sec['prefill'] as List?;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SectionBar('${sec['title'] ?? ''}'),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Column(children: [
          Row(children: [for (final c in cols) SizedBox(width: 110, child: Padding(padding: const EdgeInsets.all(2), child: Text('$c', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11))))]),
          for (int ri = 0; ri < nRows; ri++)
            Row(children: [
              for (int ci = 0; ci < cols.length; ci++)
                SizedBox(
                  width: 110,
                  child: Padding(
                    padding: const EdgeInsets.all(2),
                    child: TextField(
                      decoration: InputDecoration(isDense: true, hintText: prefill != null && ri < prefill.length && ci < (prefill[ri] as List).length ? '${prefill[ri][ci]}' : null),
                      onChanged: (v) => _grids['$key:$ri:$ci'] = v,
                    ),
                  ),
                ),
            ]),
        ]),
      ),
    ]);
  }

  Widget _loadcells() {
    Widget row(String rowKey, String label) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kMute)),
          const SizedBox(height: 4),
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 2.6,
            crossAxisSpacing: 4,
            mainAxisSpacing: 4,
            children: [
              for (int i = 0; i < 8; i++)
                TextField(keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: InputDecoration(hintText: '#${i + 1}', isDense: true), onChanged: (v) => _grids['$rowKey:$i'] = v),
            ],
          ),
        ]);
    _grids['lcUnit'] ??= 'mV';
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SectionBar('Load cell readings'),
      row('lc', 'Output (mV) / Impedance'),
      const SizedBox(height: 8),
      row('corner', 'Corner (kg)'),
    ]);
  }

  // ---- reviewer picker ----
  Widget _reviewerPicker(String label, List<Person> people, String value, ValueChanged<String> onChange) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kMute)),
      const SizedBox(height: 4),
      if (people.isNotEmpty)
        DropdownButtonFormField<String>(
          value: value.isEmpty ? null : value,
          isExpanded: true,
          items: [for (final p in people) DropdownMenuItem(value: p.email, child: Text('${p.name} (${p.email})', overflow: TextOverflow.ellipsis))],
          onChanged: (v) => onChange(v ?? ''),
          hint: const Text('— choose —'),
        )
      else
        TextField(keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(hintText: 'name@company.com'), onChanged: onChange),
    ]);
  }

  // ---- photos ----
  Widget _photosSection() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (int i = 0; i < _photos.length; i++)
          Stack(children: [
            ClipRRect(borderRadius: BorderRadius.circular(6), child: Image.memory(base64Decode('${_photos[i]['src']}'.split(',').last), width: 90, height: 90, fit: BoxFit.cover)),
            Positioned(right: 0, top: 0, child: GestureDetector(onTap: () => setState(() => _photos.removeAt(i)), child: Container(color: Colors.black54, child: const Icon(Icons.close, color: Colors.white, size: 18)))),
          ]),
        if (_photos.length < 6)
          GestureDetector(
            onTap: _addPhoto,
            child: Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(6), border: Border.all(color: kLine)),
              child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.add_a_photo_outlined, color: kMute), SizedBox(height: 4), Text('Add', style: TextStyle(color: kMute, fontSize: 12))]),
            ),
          ),
      ]),
      if (_photos.isEmpty) const Padding(padding: EdgeInsets.only(top: 6), child: Text('Up to 6 photos. Location is captured if permitted.', style: TextStyle(color: kMute, fontSize: 12))),
    ]);
  }

  Future<void> _addPhoto() async {
    try {
      final x = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 60, maxWidth: 1600);
      if (x == null) return;
      final bytes = await x.readAsBytes();
      final src = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      Map<String, dynamic>? gps;
      try {
        var perm = await Geolocator.checkPermission();
        if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
        if (perm != LocationPermission.denied && perm != LocationPermission.deniedForever) {
          final pos = await Geolocator.getCurrentPosition();
          gps = {'lat': pos.latitude, 'lng': pos.longitude, 'acc': pos.accuracy.round()};
        }
      } catch (_) {}
      setState(() => _photos.add({'src': src, 'caption': '', 'takenAt': DateTime.now().toIso8601String(), if (gps != null) 'gps': gps}));
    } catch (e) {
      showError(context, 'Could not add photo: $e');
    }
  }

  Color _colorForKey(String key) {
    const m = {'ok': kPass, 'pass': kPass, 'attn': kWait, 'adj': kWait, 'na': kMute, 'problem': kFail, 'fail': kFail};
    return m[key] ?? kFail;
  }
}
