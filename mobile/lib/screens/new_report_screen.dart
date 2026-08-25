import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image/image.dart' as img;
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
  List<Person> _technicalManagers = [], _projectManagers = [];
  List<String> _clients = [];
  List<Map<String, dynamic>> _weighbridges = [];
  bool _wbManual = false; // "Other" chosen — type the weighbridge by hand

  Map<String, dynamic>? _tpl; // chosen template

  // form state
  final _client = TextEditingController();
  final _site = TextEditingController();
  final _weighbridge = TextEditingController();
  final List<String> _supervisorEmails = [];
  String _managerEmail = '';

  // Daily / weekly / monthly forms are single-stage: one approver ("Client")
  // signs off and the report is Approved — no manager stage.
  bool get _single => _tpl != null && const ['WB01', 'WB02', 'WB03'].contains(_tpl!['code']);
  // The Technical Report is role-locked: Technical Manager then Project Manager.
  bool get _isTR => _tpl != null && _tpl!['code'] == 'TR01';
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
      _technicalManagers = dir['technicalManagers'] ?? [];
      _projectManagers = dir['projectManagers'] ?? [];
      try { _clients = await api.getClients(); } catch (_) {}
      try { _weighbridges = await api.getWeighbridges(); } catch (_) {}
      final u = context.read<Session>().user!;
      // Prefill the client for a single assignment; with several, leave it blank
      // so the technician chooses from the dropdown.
      if (u.assignedClients.length == 1) {
        _client.text = '${u.assignedClients.first['name'] ?? ''}';
      } else if (u.assignedClients.isEmpty && (u.clientName ?? '').isNotEmpty) {
        _client.text = u.clientName!;
      }
      // The technician's assigned site (branch) auto-fills.
      if ((u.site ?? '').isNotEmpty) _site.text = u.site!;
      // Auto-select the weighbridge when the technician has a single assigned
      // unit, so client / site / weighbridge are all populated with no manual step.
      final c = _client.text.trim().toLowerCase();
      final mine = _weighbridges.where((w) => c.isEmpty || '${w['client'] ?? ''}'.toLowerCase() == c).toList();
      if (mine.length == 1) _applyWeighbridge(mine.first);
    } catch (e) {
      _loadErr = e.toString();
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _submit() async {
    if (!_supervisorEmails.any((e) => RegExp(r'\S+@\S+\.\S+').hasMatch(e))) return showError(context, _isTR ? "Add the Technical Manager." : (_single ? "Add at least one Client." : "Add at least one Equipment User."));
    if (!_single && !RegExp(r'\S+@\S+\.\S+').hasMatch(_managerEmail)) return showError(context, _isTR ? "Add the Project Manager." : "Choose the Client/Manager's email.");
    if (_client.text.trim().isEmpty) return showError(context, 'Choose the client (plant).');
    setState(() => _busy = true);
    try {
      // Best-effort location capture for geofencing (proof of on-site attendance).
      final loc = await _currentLocation();
      final serial = await context.read<Session>().api.submitReport({
        'template': _tpl!['code'],
        'weighbridgeId': _weighbridge.text.trim(),
        'clientName': _client.text.trim(),
        'site': _site.text.trim(),
        'supervisorEmails': _supervisorEmails.map((e) => e.trim()).toList(),
        'managerEmail': _managerEmail.trim(),
        'values': _values,
        'checks': _checks,
        'grids': _grids,
        'runs': _runs,
        'photos': _photos,
        if (loc != null) 'filedLat': loc['lat'],
        if (loc != null) 'filedLng': loc['lng'],
        if (loc != null) 'filedAccuracy': loc['acc'],
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

  // Current GPS for geofencing — mirrors the photo-capture permission flow.
  // Returns null if unavailable or the user declines; submission proceeds either way.
  Future<Map<String, dynamic>?> _currentLocation() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return null;
      final pos = await Geolocator.getCurrentPosition();
      return {'lat': pos.latitude, 'lng': pos.longitude, 'acc': pos.accuracy};
    } catch (_) {
      return null;
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
    // The Technical Report is a field-service report (not tied to a weighbridge).
    final needsWeighbridge = _tpl!['code'] != 'TR01';
    return ListView(padding: const EdgeInsets.all(14), children: [
      const Text('Serial number is assigned when you submit.', style: TextStyle(color: kMute, fontSize: 12)),
      SectionBar(needsWeighbridge ? 'Client, site & weighbridge' : 'Client & site'),
      // Any filer may pick ANY client (assigned ones are prefilled as a shortcut)
      // or add a brand-new one. Works for every template, including the TR.
      _allClientsDropdown(),
      _field('Site / branch', _site),
      Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(onPressed: _showAddClient, icon: const Icon(Icons.add, size: 18), label: const Text('New client & site')),
      ),
      if (needsWeighbridge) _weighbridgePicker(),

      for (int si = 0; si < sections.length; si++) ..._section(Map<String, dynamic>.from(sections[si]), si),

      const SectionBar('Photos'),
      _photosSection(),

      const SectionBar('Approval route'),
      // The Technical Report is reviewed by a Technical Manager, then approved by
      // a Project Manager (role-locked). Other forms use the standard route.
      _multiReviewerPicker(
        _isTR ? 'Technical Manager — reviews first' : (_single ? 'Client(s) — approves' : 'Equipment User(s) — any one reviews'),
        _isTR ? _technicalManagers : _supervisors,
        _supervisorEmails,
      ),
      if (!_single) ...[
        const SizedBox(height: 8),
        _reviewerPicker(_isTR ? 'Project Manager — approves' : 'Client/Manager (approves)', _isTR ? _projectManagers : _managers, _managerEmail, (v) => setState(() => _managerEmail = v)),
      ],
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

  // Client picker over ALL clients (assigned client is prefilled as a shortcut).
  Widget _allClientsDropdown() {
    final names = [..._clients];
    if (_client.text.isNotEmpty && !names.contains(_client.text)) names.insert(0, _client.text);
    final value = _client.text.isEmpty ? null : _client.text;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Client (company)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kMute)),
        const SizedBox(height: 4),
        DropdownButtonFormField<String>(
          value: value,
          isExpanded: true,
          decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12)),
          hint: const Text('Select a client'),
          items: [for (final n in names) DropdownMenuItem(value: n, child: Text(n, overflow: TextOverflow.ellipsis))],
          onChanged: (v) => setState(() { _client.text = v ?? ''; _site.text = ''; }),
        ),
      ]),
    );
  }

  // Add a brand-new client (+ optional site) inline. The server refuses any name
  // that already exists in any casing, so no duplicate is ever created.
  Future<void> _showAddClient() async {
    final nameC = TextEditingController();
    final siteC = TextEditingController();
    final latC = TextEditingController();
    final lngC = TextEditingController();
    bool busy = false;
    String? err;
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setLocal) {
        Future<void> save() async {
          if (nameC.text.trim().isEmpty) { setLocal(() => err = "Enter the new client's name."); return; }
          setLocal(() { busy = true; err = null; });
          try {
            final d = await context.read<Session>().api.quickAddClient(
              name: nameC.text.trim(), site: siteC.text.trim(), lat: latC.text.trim(), lng: lngC.text.trim(),
            );
            final cn = '${(d['client'] as Map)['name'] ?? ''}';
            setState(() {
              if (cn.isNotEmpty && !_clients.contains(cn)) _clients.add(cn);
              _client.text = cn;
              _site.text = '${d['site'] ?? siteC.text.trim()}';
            });
            if (mounted) Navigator.pop(ctx);
          } catch (e) {
            setLocal(() { busy = false; err = '$e'; });
          }
        }

        return AlertDialog(
          title: const Text('Add a new client'),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(controller: nameC, decoration: const InputDecoration(labelText: 'New client name')),
              const SizedBox(height: 8),
              TextField(controller: siteC, decoration: const InputDecoration(labelText: 'Site / branch (optional)')),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(child: TextField(controller: latC, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Lat (optional)'))),
                const SizedBox(width: 8),
                Expanded(child: TextField(controller: lngC, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Lng (optional)'))),
              ]),
              const SizedBox(height: 6),
              const Text('Only a client not already in the list — existing ones (any spelling) can’t be added again.', style: TextStyle(fontSize: 11.5, color: kMute)),
              if (err != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(err!, style: const TextStyle(color: kFail, fontSize: 12.5))),
            ]),
          ),
          actions: [
            TextButton(onPressed: busy ? null : () => Navigator.pop(ctx), child: const Text('Cancel')),
            ElevatedButton(onPressed: busy ? null : save, child: Text(busy ? 'Adding…' : 'Add & use')),
          ],
        );
      }),
    );
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

  // A read-only field — value shown but not editable (assigned client / site).
  Widget _readonlyField(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kMute)),
          const SizedBox(height: 4),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
            decoration: BoxDecoration(color: const Color(0xFFF5F1E8), border: Border.all(color: kLine), borderRadius: BorderRadius.circular(12)),
            child: Text(value.isEmpty ? '—' : value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: kInk)),
          ),
        ]),
      );

  // Adopt a registered weighbridge onto the form — set the weighbridge and fill
  // client / site / equipment details FROM the registry, only where still empty.
  // Callers wrap this in setState.
  void _applyWeighbridge(Map<String, dynamic> w) {
    _wbManual = false;
    _weighbridge.text = '${w['label'] ?? ''}';
    if (_client.text.trim().isEmpty && (w['client'] ?? '') != '') _client.text = '${w['client']}';
    if (_site.text.trim().isEmpty && (w['site'] ?? '') != '') _site.text = '${w['site']}';
    if ((w['makeModel'] ?? '') != '') _values['make'] = w['makeModel'];
    if ((w['serialNo'] ?? '') != '') _values['serialNo'] = w['serialNo'];
    if ((w['capacity'] ?? '') != '') _values['capacity'] = w['capacity'];
    if ((w['deckLength'] ?? '') != '') _values['deckLength'] = w['deckLength'];
    if (_managerEmail.isEmpty && (w['managerEmail'] ?? '') != '') _managerEmail = '${w['managerEmail']}';
  }

  // Weighbridge dropdown — the client's registered weighbridges. Picking one
  // fills the weighbridge, adopts its site/branch when none is set, and pre-fills
  // make/serial/capacity + the routed Client/Manager. "Other" allows a manual
  // entry for anything not yet registered.
  Widget _weighbridgePicker() {
    final c = _client.text.trim().toLowerCase();
    final list = _weighbridges.where((w) => c.isEmpty || '${w['client'] ?? ''}'.toLowerCase() == c).toList();
    final labels = list.map((w) => '${w['label']}').toList();
    final current = _weighbridge.text.trim();
    final inList = labels.contains(current);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Weighbridge', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kMute)),
        const SizedBox(height: 4),
        if (labels.isNotEmpty)
          DropdownButtonFormField<String>(
            value: inList ? current : null,
            isExpanded: true,
            hint: const Text('Select a weighbridge'),
            items: [
              ...list.map((w) => DropdownMenuItem(
                    value: '${w['label']}',
                    child: Text('${w['label']}${(w['site'] ?? '') != '' ? " — ${w['site']}" : ""}', overflow: TextOverflow.ellipsis),
                  )),
              const DropdownMenuItem(value: '__other', child: Text('Other (type below)')),
            ],
            onChanged: (v) {
              if (v == null) return;
              if (v == '__other') { setState(() { _wbManual = true; _weighbridge.text = ''; }); return; }
              final w = list.firstWhere((x) => '${x['label']}' == v, orElse: () => {});
              setState(() => _applyWeighbridge(w));
            },
          ),
        if (labels.isEmpty || _wbManual) ...[
          const SizedBox(height: 6),
          TextField(controller: _weighbridge, decoration: const InputDecoration(hintText: 'e.g. WB-1')),
        ],
      ]),
    );
  }

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
          {'key': 'problem', 'label': sec['no'] ?? 'NO'}
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
    final k = '${sec['k']}';
    if (sec['dropdown'] == true) {
      final current = _values[k];
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SectionBar('${sec['title'] ?? ''}'),
        DropdownButtonFormField<String>(
          value: options.contains(current) ? current as String : null,
          isExpanded: true,
          decoration: const InputDecoration(isDense: true, hintText: 'Select…'),
          items: [for (final o in options) DropdownMenuItem<String>(value: '$o', child: Text('$o'))],
          onChanged: (v) => setState(() => _values[k] = v),
        ),
      ]);
    }
    // Multi-select stores the chosen options as a comma-joined string
    // (e.g. "Service, Repairs") — more than one kind of work can be done in
    // the same visit. Single-select stores one string.
    final bool multi = sec['multi'] == true;
    List<String> selected() =>
        '${_values[k] ?? ''}'.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
    bool isOn(String o) => multi ? selected().contains(o) : _values[k] == o;
    void toggle(String o) {
      if (!multi) {
        setState(() => _values[k] = o);
        return;
      }
      final cur = selected();
      final next = cur.contains(o) ? (cur..remove(o)) : (cur..add(o));
      // keep template order for a stable, readable value
      final ordered = [for (final x in options) if (next.contains('$x')) '$x'];
      setState(() => _values[k] = ordered.join(', '));
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SectionBar('${sec['title'] ?? ''}'),
      if (multi)
        const Padding(padding: EdgeInsets.only(bottom: 6), child: Text('Pick all that apply.', style: TextStyle(fontSize: 12, color: kMute))),
      for (final o in options)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: GestureDetector(
            onTap: () => toggle('$o'),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: isOn('$o') ? kCoal : Colors.white, borderRadius: BorderRadius.circular(3), border: Border.all(color: isOn('$o') ? kCoal : const Color(0xFFCFC8BA))),
              child: Row(children: [
                if (multi) Padding(padding: const EdgeInsets.only(right: 8), child: Icon(isOn('$o') ? Icons.check_box : Icons.check_box_outline_blank, size: 18, color: isOn('$o') ? kGold : kInk)),
                Expanded(child: Text('$o', style: TextStyle(color: isOn('$o') ? kGold : kInk, fontWeight: isOn('$o') ? FontWeight.w700 : FontWeight.w400))),
              ]),
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

  // Pick one or more Equipment Users — any one of them can review.
  Widget _multiReviewerPicker(String label, List<Person> people, List<String> chosen) {
    String nameFor(String email) {
      final p = people.where((p) => p.email.toLowerCase() == email.toLowerCase());
      return p.isNotEmpty ? p.first.name : email;
    }
    final available = people.where((p) => !chosen.any((e) => e.toLowerCase() == p.email.toLowerCase())).toList();
    final custom = TextEditingController();
    void add(String email) {
      final e = email.trim();
      if (e.isEmpty || chosen.any((x) => x.toLowerCase() == e.toLowerCase())) return;
      setState(() => chosen.add(e));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kMute)),
      const SizedBox(height: 4),
      if (chosen.isNotEmpty)
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final e in chosen)
            Chip(
              label: Text(nameFor(e), style: const TextStyle(fontSize: 12, color: kGold, fontWeight: FontWeight.w700)),
              backgroundColor: kCoal,
              deleteIconColor: kGold,
              onDeleted: () => setState(() => chosen.remove(e)),
            ),
        ]),
      if (available.isNotEmpty)
        DropdownButtonFormField<String>(
          value: null,
          isExpanded: true,
          hint: const Text('— add an Equipment User —'),
          items: [for (final p in available) DropdownMenuItem(value: p.email, child: Text('${p.name} (${p.email})', overflow: TextOverflow.ellipsis))],
          onChanged: (v) { if (v != null) add(v); },
        ),
      Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Row(children: [
          Expanded(child: TextField(controller: custom, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(hintText: 'or type an email', isDense: true))),
          const SizedBox(width: 6),
          OutlinedButton(onPressed: () { add(custom.text); custom.clear(); }, child: const Text('Add')),
        ]),
      ),
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
      // Force every photo to landscape: bake the EXIF orientation, then rotate a
      // portrait capture 90° so the stored image is always wider than tall.
      Uint8List out = bytes;
      try {
        final decoded = img.decodeImage(bytes);
        if (decoded != null) {
          var pic = img.bakeOrientation(decoded);
          if (pic.height > pic.width) pic = img.copyRotate(pic, angle: 90);
          out = Uint8List.fromList(img.encodeJpg(pic, quality: 70));
        }
      } catch (_) {}
      final src = 'data:image/jpeg;base64,${base64Encode(out)}';
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
