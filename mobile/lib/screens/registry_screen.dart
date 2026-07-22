import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../session.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/app_drawer.dart';
import 'report_detail_screen.dart';
import 'new_report_screen.dart';

const _filers = {'TECHNICIAN', 'ENGINEER', 'SUPERVISOR', 'MANAGER', 'PROJECT_MANAGER', 'TECHNICAL_MANAGER', 'ADMIN'};
const _filters = [
  ['all', 'All'],
  ['PENDING_SUPERVISOR', 'Supervisor'],
  ['PENDING_MANAGER', 'Manager'],
  ['APPROVED', 'Approved'],
  ['REJECTED', 'Rejected'],
];

class RegistryScreen extends StatefulWidget {
  // Filter driven from the dashboard (chart drill-down). filterNonce bumps every
  // time the parent requests a filter, so the same status can be re-applied.
  final String status;
  final String query;
  final int filterNonce;
  final void Function(int index)? onNavigate;
  const RegistryScreen({super.key, this.status = 'all', this.query = '', this.filterNonce = 0, this.onNavigate});
  @override
  State<RegistryScreen> createState() => _RegistryScreenState();
}

class _RegistryScreenState extends State<RegistryScreen> {
  late String _filter = widget.status;
  late String _q = widget.query;
  late final TextEditingController _search = TextEditingController(text: widget.query);
  Future<List<ReportSummary>>? _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant RegistryScreen old) {
    super.didUpdateWidget(old);
    // The dashboard asked us to jump to a filtered view.
    if (widget.filterNonce != old.filterNonce) {
      setState(() {
        _filter = widget.status;
        _q = widget.query;
        _search.text = widget.query;
        _load();
      });
    }
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _load() {
    final api = context.read<Session>().api;
    _future = api.getReports(status: _filter, q: _q);
  }

  void _reload() => setState(_load);

  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    final user = s.user!;
    final canFile = user.roles.any(_filers.contains);
    final active = _filter != 'all' || _q.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const Brand(onDark: true),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 6),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(user.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
              Text(kRoleLabel[user.role] ?? user.role, style: const TextStyle(color: kGold, fontSize: 10, fontWeight: FontWeight.w700)),
            ]),
          ),
        ],
      ),
      drawer: AppDrawer(current: 1, onNavigate: widget.onNavigate ?? (_) {}),
      floatingActionButton: canFile
          ? FloatingActionButton.extended(
              backgroundColor: kGold,
              foregroundColor: kCoal,
              icon: const Icon(Icons.add),
              label: const Text('New report', style: TextStyle(fontWeight: FontWeight.w800)),
              onPressed: () async {
                final done = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => const NewReportScreen()));
                if (done == true) _reload();
              },
            )
          : null,
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
          child: TextField(
            controller: _search,
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search, color: kMute),
              hintText: 'Search serial, author, site…',
              suffixIcon: _q.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.close, color: kMute),
                      onPressed: () {
                        _search.clear();
                        _q = '';
                        _reload();
                      },
                    )
                  : null,
            ),
            onChanged: (v) => _q = v,
            onSubmitted: (_) => _reload(),
          ),
        ),
        SizedBox(
          height: 52,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12), children: [
            for (final f in _filters)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(f[1]),
                  selected: _filter == f[0],
                  selectedColor: kCoal,
                  labelStyle: TextStyle(color: _filter == f[0] ? kGold : kInk, fontWeight: FontWeight.w700, fontSize: 12),
                  backgroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6), side: const BorderSide(color: kLine)),
                  onSelected: (_) {
                    _filter = f[0];
                    _reload();
                  },
                ),
              ),
          ]),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async => _reload(),
            child: FutureBuilder<List<ReportSummary>>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator(color: kCoal));
                if (snap.hasError) return _message('Could not load: ${snap.error}');
                final rows = snap.data ?? [];
                if (rows.isEmpty) return _message(active ? 'No reports match this filter.' : 'Nothing here yet.');
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 90),
                  itemCount: rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, i) => _card(context, rows[i]),
                );
              },
            ),
          ),
        ),
      ]),
    );
  }

  Widget _message(String t) => ListView(children: [
        Padding(
          padding: const EdgeInsets.only(top: 90),
          child: Column(children: [
            Icon(Icons.inbox_outlined, size: 46, color: kMute.withOpacity(0.5)),
            const SizedBox(height: 10),
            Center(child: Text(t, style: const TextStyle(color: kMute))),
          ]),
        )
      ]);

  // A report filed within the last 24 hours is tagged "NEW" for every role.
  bool _isRecent(ReportSummary r) {
    final d = r.createdAt != null ? DateTime.tryParse(r.createdAt!) : null;
    return d != null && DateTime.now().difference(d.toLocal()).inHours < 24;
  }

  String _relTime(String? iso) {
    final d = iso != null ? DateTime.tryParse(iso)?.toLocal() : null;
    if (d == null) return '';
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return 'yesterday';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('d MMM y').format(d);
  }

  Widget _card(BuildContext context, ReportSummary r) {
    final recent = _isRecent(r);
    return AppCard(
      onTap: () async {
        final changed = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => ReportDetailScreen(serial: r.serial)));
        if (changed == true) _reload();
      },
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Row(children: [
            Serial(r.serial),
            if (recent) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: kGold, borderRadius: BorderRadius.circular(3)),
                child: const Text('NEW', style: TextStyle(color: kCoal, fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 0.4)),
              ),
            ],
          ]),
          StatusPill(r.status),
        ]),
        const SizedBox(height: 12),
        Text(r.templateName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: kInk)),
        const SizedBox(height: 8),
        _metaRow(Icons.location_on_outlined, '${r.clientName}${r.site != null && r.site!.isNotEmpty ? " · ${r.site}" : ""}'),
        const SizedBox(height: 3),
        _metaRow(Icons.scale_outlined, r.weighbridgeId ?? 'weighbridge not stated'),
        const SizedBox(height: 3),
        _metaRow(Icons.person_outline, '${r.authorName ?? "-"} · ${_relTime(r.createdAt)}'),
      ]),
    );
  }

  Widget _metaRow(IconData icon, String text) => Row(children: [
        Icon(icon, size: 15, color: kMute),
        const SizedBox(width: 6),
        Expanded(child: Text(text, style: const TextStyle(color: kMute, fontSize: 12.5), maxLines: 1, overflow: TextOverflow.ellipsis)),
      ]);
}
