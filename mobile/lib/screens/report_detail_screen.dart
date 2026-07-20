import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../session.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

Color _colorFor(String key) {
  const m = {'ok': kPass, 'pass': kPass, 'attn': kWait, 'adj': kWait, 'na': kMute, 'problem': kFail, 'fail': kFail};
  return m[key] ?? kFail;
}

class ReportDetailScreen extends StatefulWidget {
  final String serial;
  const ReportDetailScreen({super.key, required this.serial});
  @override
  State<ReportDetailScreen> createState() => _ReportDetailScreenState();
}

class _ReportDetailScreenState extends State<ReportDetailScreen> {
  ReportDetail? _detail;
  Map<String, dynamic>? _template; // matching template definition
  String? _err;
  bool _busy = false;
  bool _changed = false;
  final _comment = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<Session>().api;
    try {
      final d = await api.getReport(widget.serial);
      Map<String, dynamic>? tpl;
      try {
        final t = await api.getTemplates();
        final code = d.report['template'];
        tpl = ((t['templates'] as List?) ?? []).cast<Map>().map((e) => Map<String, dynamic>.from(e)).firstWhere((e) => e['code'] == code, orElse: () => {});
        if (tpl.isEmpty) tpl = null;
      } catch (_) {}
      if (mounted) setState(() { _detail = d; _template = tpl; });
    } catch (e) {
      if (mounted) setState(() => _err = e.toString());
    }
  }

  Future<void> _decide(String decision) async {
    if (decision == 'reject' && _comment.text.trim().isEmpty) {
      showError(context, 'A comment is required to reject.');
      return;
    }
    setState(() => _busy = true);
    try {
      await context.read<Session>().api.decide(widget.serial, decision, _comment.text.trim());
      _changed = true;
      await _load();
    } catch (e) {
      showError(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvoked: (didPop) {
        if (!didPop) Navigator.pop(context, _changed);
      },
      child: Scaffold(
        appBar: AppBar(title: Text(widget.serial, style: const TextStyle(fontFamily: 'monospace', fontSize: 15))),
        body: _err != null
            ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_err!, style: const TextStyle(color: kFail))))
            : _detail == null
                ? const Center(child: CircularProgressIndicator(color: kCoal))
                : _body(_detail!),
      ),
    );
  }

  Widget _body(ReportDetail d) {
    final r = d.report;
    final data = Map<String, dynamic>.from(r['data'] ?? {});
    final values = Map<String, dynamic>.from(data['values'] ?? {});
    final checks = Map<String, dynamic>.from(data['checks'] ?? {});
    final photos = (r['photos'] as List?) ?? [];
    final trail = (r['trailEvents'] as List?) ?? [];
    final pending = r['status'] == 'PENDING_SUPERVISOR' || r['status'] == 'PENDING_MANAGER';
    final sections = (_template?['sections'] as List?) ?? [];

    return ListView(padding: const EdgeInsets.all(14), children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Expanded(child: Text(r['templateName'] ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: kInk))),
        StatusPill(r['status'] ?? ''),
      ]),
      const SizedBox(height: 4),
      Text('${r['clientName'] ?? ''}${(r['site'] ?? '') != '' ? " - ${r['site']}" : ""} · ${r['weighbridgeId'] ?? "weighbridge not stated"} · by ${r['authorName'] ?? "-"}',
          style: const TextStyle(color: kMute, fontSize: 12)),

      // Approval route
      if (pending) ...[
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: const Color(0xFFF3EEE2), borderRadius: BorderRadius.circular(8)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('APPROVAL ROUTE', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: kInk, letterSpacing: 0.4)),
            const SizedBox(height: 8),
            _reviewer('Equipment User (reviews first)', d.reviewers.supervisorName, d.reviewers.supervisorEmail,
                r['status'] == 'PENDING_SUPERVISOR' ? 'current' : 'done'),
            const SizedBox(height: 6),
            _reviewer('Client/Manager (final approval)', d.reviewers.managerName, d.reviewers.managerEmail,
                r['status'] == 'PENDING_MANAGER' ? 'current' : (r['status'] == 'PENDING_SUPERVISOR' ? 'waiting' : 'done')),
          ]),
        ),
      ],

      // Action panel — only if the signed-in user is the routed reviewer.
      if (pending && d.actAs != null) ...[
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: const Color(0xFFFDF6E3), borderRadius: BorderRadius.circular(8), border: Border.all(color: kGold)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(d.actAs == 'SUPERVISOR' ? 'YOUR REVIEW' : 'YOUR APPROVAL', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: kInk)),
            const SizedBox(height: 4),
            const Text('Your decision is recorded with your name and the time.', style: TextStyle(color: kMute, fontSize: 12)),
            const SizedBox(height: 10),
            TextField(controller: _comment, minLines: 1, maxLines: 3, decoration: const InputDecoration(hintText: 'Comment (required to reject)')),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: kPass, foregroundColor: Colors.white),
                onPressed: _busy ? null : () => _decide('approve'),
                child: const Text('APPROVE'),
              )),
              const SizedBox(width: 8),
              Expanded(child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: kFail, foregroundColor: Colors.white),
                onPressed: _busy ? null : () => _decide('reject'),
                child: const Text('REJECT'),
              )),
            ]),
          ]),
        ),
      ],
      if (pending && d.actAs == null)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text('Only the routed ${r['status'] == 'PENDING_SUPERVISOR' ? "Equipment User" : "Client/Manager"} can approve or reject this report.',
              style: const TextStyle(color: kMute, fontSize: 12, fontStyle: FontStyle.italic)),
        ),

      // Free fields
      for (final e in values.entries)
        if (e.key != 'weighbridgeId' && '${e.value}'.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text.rich(TextSpan(children: [
              TextSpan(text: '${e.key.toUpperCase()}: ', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: kMute)),
              TextSpan(text: '${e.value}', style: const TextStyle(fontSize: 14, color: kInk)),
            ])),
          ),

      // Checklists (from the template)
      for (int si = 0; si < sections.length; si++)
        if ((sections[si] as Map)['type'] == 'checklist') _checklist(Map<String, dynamic>.from(sections[si]), si, checks),

      // Photos
      if (photos.isNotEmpty) ...[
        const SectionBar('Photo evidence'),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 6,
          mainAxisSpacing: 6,
          children: [
            for (final p in photos)
              GestureDetector(
                onTap: () => _viewPhoto('${(p as Map)['dataUrl']}'),
                child: _thumb('${(p as Map)['dataUrl']}'),
              ),
          ],
        ),
      ],

      // Trail
      const SectionBar('Approval trail'),
      for (final t in trail)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Padding(padding: EdgeInsets.only(top: 4, right: 8), child: Icon(Icons.circle, size: 8, color: kGold)),
            Expanded(
              child: Text.rich(TextSpan(children: [
                TextSpan(text: '${(t as Map)['action']}', style: const TextStyle(fontWeight: FontWeight.w700, color: kInk, fontSize: 13)),
                if (t['comment'] != null) TextSpan(text: ' — "${t['comment']}"', style: const TextStyle(color: kFail, fontSize: 13)),
                TextSpan(text: '\n${t['byName']} · ${_fmt(t['at'])}', style: const TextStyle(color: kMute, fontSize: 12)),
              ])),
            ),
          ]),
        ),
      const SizedBox(height: 30),
    ]);
  }

  Widget _checklist(Map<String, dynamic> sec, int si, Map<String, dynamic> checks) {
    final items = (sec['items'] as List?) ?? [];
    final states = (sec['states'] as List?) ??
        [
          {'key': 'ok', 'label': sec['yes'] ?? 'OK'},
          {'key': 'problem', 'label': sec['no'] ?? 'ATTN'}
        ];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SectionBar('${sec['title'] ?? 'Checklist'}'),
      for (int ii = 0; ii < items.length; ii++)
        Builder(builder: (_) {
          final v = checks['$si:$ii'] as Map?;
          final stateKey = v?['state'];
          final st = states.cast<Map>().firstWhere((s) => s['key'] == stateKey, orElse: () => {});
          final isGood = st.isNotEmpty && st['key'] == (states.first as Map)['key'];
          return Container(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFFEAE4D6)))),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: Text('${items[ii]}', style: const TextStyle(fontSize: 14, color: kInk))),
              const SizedBox(width: 8),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(st.isEmpty ? '—' : '${isGood ? "✓ " : ""}${st['label']}',
                    style: TextStyle(fontWeight: FontWeight.w800, color: st.isEmpty ? const Color(0xFFB8AF9E) : _colorFor('$stateKey'))),
                if (v?['remark'] != null && '${v!['remark']}'.isNotEmpty)
                  SizedBox(width: 130, child: Text('${v['remark']}', textAlign: TextAlign.right, style: const TextStyle(color: kFail, fontSize: 12))),
              ]),
            ]),
          );
        }),
    ]);
  }

  Widget _reviewer(String label, String? name, String? email, String state) {
    final color = state == 'current' ? kWait : (state == 'done' ? kPass : kMute);
    final icon = state == 'current' ? Icons.hourglass_top : (state == 'done' ? Icons.check_circle : Icons.schedule);
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, size: 16, color: color),
      const SizedBox(width: 6),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 11, color: kMute, fontWeight: FontWeight.w700)),
          Text('${name ?? "—"}${email != null ? "  ·  $email" : ""}', style: const TextStyle(fontSize: 13, color: kInk)),
        ]),
      ),
    ]);
  }

  Widget _thumb(String dataUrl) {
    final bytes = _bytes(dataUrl);
    return ClipRRect(
      borderRadius: BorderRadius.circular(4),
      child: bytes == null
          ? Container(color: const Color(0xFFF3EEE2))
          : Image.memory(bytes, fit: BoxFit.cover, gaplessPlayback: true),
    );
  }

  void _viewPhoto(String dataUrl) {
    final bytes = _bytes(dataUrl);
    if (bytes == null) return;
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: EdgeInsets.zero,
        child: Stack(children: [
          InteractiveViewer(minScale: 1, maxScale: 6, child: Center(child: Image.memory(bytes))),
          Positioned(top: 8, right: 8, child: IconButton(icon: const Icon(Icons.close, color: Colors.white), onPressed: () => Navigator.pop(context))),
        ]),
      ),
    );
  }

  static String _fmt(dynamic iso) {
    final d = DateTime.tryParse('$iso');
    return d == null ? '$iso' : DateFormat('d MMM y, h:mm a').format(d.toLocal());
  }
}

// Decode a "data:image/...;base64,XXXX" URL to bytes for Image.memory.
Uint8List? _bytes(String dataUrl) {
  final i = dataUrl.indexOf(',');
  if (i < 0) return null;
  try {
    return base64Decode(dataUrl.substring(i + 1));
  } catch (_) {
    return null;
  }
}
