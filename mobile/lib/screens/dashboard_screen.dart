import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/charts.dart';
import '../widgets/app_drawer.dart';
import 'report_detail_screen.dart';

const _oversight = {'ADMIN', 'PROJECT_MANAGER', 'TECHNICAL_MANAGER'};

class DashboardScreen extends StatefulWidget {
  final void Function({String status, String query}) onOpenReports;
  final void Function(int index) onNavigate;
  const DashboardScreen({super.key, required this.onOpenReports, required this.onNavigate});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _d;
  String? _err;
  Timer? _timer;
  String _view = 'ALL'; // role lens

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = await context.read<Session>().api.getStats();
      if (mounted) setState(() { _d = d; _err = null; });
    } catch (e) {
      if (mounted && _d == null) setState(() => _err = e.toString());
    }
  }

  // Which card groups a chosen role lens shows.
  bool _show(String key) {
    if (_view == 'ALL' || _oversight.contains(_view)) return true;
    if (_view == 'SUPERVISOR' || _view == 'MANAGER' || _view == 'TECHNICIAN' || _view == 'ENGINEER') {
      return {'kpis', 'trend', 'status', 'templates', 'recent'}.contains(key);
    }
    if (_view == 'CLIENT') return {'kpis', 'quotations', 'calibration', 'recent'}.contains(key);
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    final roles = s.user!.roles;
    return Scaffold(
      appBar: AppBar(
        title: const Brand(onDark: true),
        actions: [IconButton(icon: const Icon(Icons.description_outlined), tooltip: 'All reports', onPressed: () => widget.onOpenReports())],
      ),
      drawer: AppDrawer(current: 0, onNavigate: widget.onNavigate),
      body: _err != null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_err!, style: const TextStyle(color: kFail))))
          : _d == null
              ? const Center(child: CircularProgressIndicator(color: kCoal))
              : RefreshIndicator(onRefresh: _load, child: _content(s, roles)),
    );
  }

  Widget _content(Session s, List<String> roles) {
    final d = _d!;
    final status = Map<String, dynamic>.from(d['reportsByStatus'] ?? {});
    int st(String k) => ((status[k] ?? 0) as num).toInt();
    final pending = st('PENDING_SUPERVISOR') + st('PENDING_MANAGER');
    final quotations = d['quotations'] as Map?;
    final calib = d['calibrationRequests'] as Map?;
    final satisfaction = d['satisfaction'] as Map?;
    final trend = ((d['reportsTrend'] as List?) ?? []).map((e) => ((e['count'] ?? 0) as num).toDouble()).toList();
    final templates = (d['reportsByTemplate'] as List?) ?? [];
    final recent = (d['recent'] as List?) ?? [];
    final isClient = d['isClient'] == true;

    final kpis = <Widget>[
      if ((d['awaitingMe'] ?? 0) > 0) StatTile(label: 'Awaiting you', value: '${d['awaitingMe']}', tone: kWait, icon: '⏳', sub: 'to review / approve', onTap: () => widget.onOpenReports(status: 'PENDING_SUPERVISOR')),
      if (!isClient) StatTile(label: 'Total reports', value: '${d['totalReports'] ?? 0}', icon: '📄', onTap: () => widget.onOpenReports()),
      if (!isClient) StatTile(label: 'Approved', value: '${st('APPROVED')}', tone: kPass, icon: '✓', onTap: () => widget.onOpenReports(status: 'APPROVED')),
      if (!isClient) StatTile(label: 'Pending', value: '$pending', tone: kWait, icon: '•', onTap: () => widget.onOpenReports(status: 'PENDING_SUPERVISOR')),
      if (satisfaction != null) StatTile(label: 'Satisfaction', value: (satisfaction['average'] ?? 0) > 0 ? '${satisfaction['average']}/5' : '—', tone: const Color(0xFF8A6D00), icon: '★', sub: '${satisfaction['count']} surveys'),
      if (d['schedulesDue'] != null) StatTile(label: 'Due in 7 days', value: '${d['schedulesDue']}', tone: (d['schedulesDue'] ?? 0) > 0 ? kWait : kInk, icon: '🗓'),
      if (quotations != null) StatTile(label: 'Quotes accepted', value: '${quotations['ACCEPTED'] ?? 0}', tone: kPass, icon: '💷'),
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 100),
      children: [
        Text('${_greeting()}, ${(d['name'] ?? '').toString().split(' ').first}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: kInk)),
        const Padding(padding: EdgeInsets.only(top: 2), child: Text('Live overview · updates automatically', style: TextStyle(color: kMute, fontSize: 13))),

        if (roles.length > 1) ...[
          const SizedBox(height: 12),
          _roleDropdown(roles),
        ],

        if (_show('kpis') && kpis.isNotEmpty) ...[
          const SizedBox(height: 14),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.55,
            children: kpis,
          ),
        ],

        if (_show('trend') && !isClient) ...[
          const SizedBox(height: 12),
          ChartCard(title: 'Reports · last 14 days', child: Trend(values: trend)),
        ],
        if (_show('status') && !isClient) ...[
          const SizedBox(height: 12),
          ChartCard(title: 'Report status', child: Donut(centerLabel: 'reports', segments: [
            Segment('Supervisor review', st('PENDING_SUPERVISOR'), const Color(0xFFC79A2E), onTap: () => widget.onOpenReports(status: 'PENDING_SUPERVISOR')),
            Segment('Manager approval', st('PENDING_MANAGER'), kGold, onTap: () => widget.onOpenReports(status: 'PENDING_MANAGER')),
            Segment('Approved', st('APPROVED'), kPass, onTap: () => widget.onOpenReports(status: 'APPROVED')),
            Segment('Rejected', st('REJECTED'), kFail, onTap: () => widget.onOpenReports(status: 'REJECTED')),
          ])),
        ],
        if (_show('templates') && !isClient && templates.isNotEmpty) ...[
          const SizedBox(height: 12),
          ChartCard(title: 'By form type', child: BarList(items: [
            for (final t in templates) Segment('${t['name']}', (t['count'] ?? 0) as num, kCoal),
          ])),
        ],
        if (_show('quotations') && quotations != null) ...[
          const SizedBox(height: 12),
          ChartCard(title: 'Quotations', child: Donut(centerLabel: 'quotes', segments: [
            Segment('Requested', (quotations['REQUESTED'] ?? 0) as num, kWait),
            Segment('Quoted', (quotations['QUOTED'] ?? 0) as num, kCoal),
            Segment('Accepted', (quotations['ACCEPTED'] ?? 0) as num, kPass),
            Segment('Declined', (quotations['DECLINED'] ?? 0) as num, kFail),
          ])),
        ],
        if (_show('calibration') && calib != null) ...[
          const SizedBox(height: 12),
          ChartCard(title: 'Calibration requests', child: BarList(items: [
            Segment('Submitted', (calib['SUBMITTED'] ?? 0) as num, kWait),
            Segment('Accepted', (calib['ACCEPTED'] ?? 0) as num, kPass),
            Segment('Not accepted', (calib['REJECTED'] ?? 0) as num, kFail),
          ])),
        ],
        if (_show('templates') && satisfaction != null) ...[
          const SizedBox(height: 12),
          ChartCard(title: 'Customer satisfaction', child: Center(child: Gauge(value: ((satisfaction['average'] ?? 0) as num).toDouble(), max: 5, label: '${satisfaction['count']} surveys'))),
        ],

        if (_show('recent') && recent.isNotEmpty) ...[
          const SizedBox(height: 12),
          ChartCard(title: 'Recent activity', child: Column(children: [
            for (final r in recent)
              InkWell(
                onTap: _isReport('${r['link'] ?? ''}')
                    ? () => Navigator.push(context, MaterialPageRoute(builder: (_) => ReportDetailScreen(serial: '${r['serial']}')))
                    : null,
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
                  child: Row(children: [
                    Serial('${r['serial']}'),
                    const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${r['title']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: kInk)),
                      Text('${r['subtitle']}', style: const TextStyle(fontSize: 12, color: kMute)),
                    ])),
                    StatusPill('${r['status']}'),
                  ]),
                ),
              ),
          ])),
        ],
      ],
    );
  }

  Widget _roleDropdown(List<String> roles) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), boxShadow: kSoftShadow),
      child: Row(children: [
        const Icon(Icons.visibility_outlined, size: 18, color: kMute),
        const SizedBox(width: 8),
        const Text('Viewing as', style: TextStyle(fontSize: 13, color: kMute, fontWeight: FontWeight.w600)),
        const SizedBox(width: 10),
        Expanded(
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _view,
              isExpanded: true,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: kInk),
              items: [
                const DropdownMenuItem(value: 'ALL', child: Text('All my roles')),
                for (final r in roles) DropdownMenuItem(value: r, child: Text(kRoleLabel[r] ?? r)),
              ],
              onChanged: (v) => setState(() => _view = v ?? 'ALL'),
            ),
          ),
        ),
      ]),
    );
  }

  // Only report links open a report detail; quotation/calibration links have no
  // mobile detail screen yet, so those rows stay non-tappable.
  static bool _isReport(String link) => link.startsWith('/reports/');

  static String _greeting() {
    final h = DateTime.now().hour;
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }
}
