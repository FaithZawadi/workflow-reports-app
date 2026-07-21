import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../session.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/app_drawer.dart';

// Bold status tiles mirroring the web task board. Each tile shows a live count
// from the tasks in the database and filters the list when tapped. The last two
// are derived buckets (no assignee / past due).
class _Tile {
  final String key, label;
  final Color color;
  final IconData icon;
  const _Tile(this.key, this.label, this.color, this.icon);
}

const _tiles = [
  _Tile('OPEN', 'Open', Color(0xFFB07A16), Icons.hourglass_empty),
  _Tile('IN_PROGRESS', 'In progress', Color(0xFF2E6DA4), Icons.settings),
  _Tile('BLOCKED', 'Blocked', Color(0xFFB03A2E), Icons.pause_circle_outline),
  _Tile('DONE', 'Done', Color(0xFF2E7D46), Icons.check_circle_outline),
  _Tile('UNASSIGNED', 'Unassigned', Color(0xFF5A4B8A), Icons.person_off_outlined),
  _Tile('OVERDUE', 'Overdue', Color(0xFF8A2D2D), Icons.error_outline),
];

const _statusColor = {
  'OPEN': Color(0xFFB07A16),
  'IN_PROGRESS': Color(0xFF2E6DA4),
  'BLOCKED': Color(0xFFB03A2E),
  'DONE': Color(0xFF2E7D46),
};
const _statusLabel = {'OPEN': 'Open', 'IN_PROGRESS': 'In progress', 'BLOCKED': 'Blocked', 'DONE': 'Done'};

class TasksScreen extends StatefulWidget {
  final void Function(int index)? onNavigate;
  const TasksScreen({super.key, this.onNavigate});
  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  Future<TasksResult>? _future;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = context.read<Session>().api.getTasks();
  }

  void _reload() => setState(_load);

  Map<String, int> _counts(List<TaskItem> tasks) {
    final c = {for (final t in _tiles) t.key: 0};
    for (final t in tasks) {
      c[t.status] = (c[t.status] ?? 0) + 1;
      if (t.unassigned) c['UNASSIGNED'] = c['UNASSIGNED']! + 1;
      if (t.overdue) c['OVERDUE'] = c['OVERDUE']! + 1;
    }
    return c;
  }

  List<TaskItem> _shown(List<TaskItem> tasks) {
    if (_filter == 'all') return tasks;
    if (_filter == 'UNASSIGNED') return tasks.where((t) => t.unassigned).toList();
    if (_filter == 'OVERDUE') return tasks.where((t) => t.overdue).toList();
    return tasks.where((t) => t.status == _filter).toList();
  }

  Future<void> _setStatus(TaskItem t, String status) async {
    try {
      await context.read<Session>().api.updateTaskStatus(t.id, status);
      _reload();
    } catch (e) {
      if (mounted) showError(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Brand(onDark: true)),
      drawer: AppDrawer(current: 2, onNavigate: widget.onNavigate ?? (_) {}),
      body: RefreshIndicator(
        onRefresh: () async => _reload(),
        child: FutureBuilder<TasksResult>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator(color: kCoal));
            if (snap.hasError) return _message('Could not load tasks: ${snap.error}');
            final res = snap.data;
            final tasks = res?.tasks ?? [];
            final counts = _counts(tasks);
            final shown = _shown(tasks);
            return ListView(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 100),
              children: [
                const Text('Tasks', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: kInk)),
                const Padding(padding: EdgeInsets.only(top: 2), child: Text('Work tracking · tap a tile to filter', style: TextStyle(color: kMute, fontSize: 13))),
                const SizedBox(height: 14),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisSpacing: 11,
                  mainAxisSpacing: 11,
                  childAspectRatio: 1.7,
                  children: [for (final tile in _tiles) _statusTile(tile, counts[tile.key] ?? 0)],
                ),
                const SizedBox(height: 8),
                if (_filter != 'all')
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(children: [
                      Text('${shown.length} shown', style: const TextStyle(color: kMute, fontSize: 12.5, fontWeight: FontWeight.w700)),
                      const Spacer(),
                      TextButton(onPressed: () => setState(() => _filter = 'all'), child: const Text('Show all', style: TextStyle(color: kCoal, fontWeight: FontWeight.w800))),
                    ]),
                  ),
                if (shown.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 40),
                    child: Column(children: [
                      Icon(Icons.inbox_outlined, size: 46, color: kMute.withOpacity(0.5)),
                      const SizedBox(height: 10),
                      Center(child: Text(tasks.isEmpty ? 'No tasks assigned to you.' : 'Nothing matches this filter.', style: const TextStyle(color: kMute))),
                    ]),
                  ),
                for (final t in shown) _taskCard(t),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _statusTile(_Tile tile, int count) {
    final active = _filter == tile.key;
    return GestureDetector(
      onTap: () => setState(() => _filter = active ? 'all' : tile.key),
      child: Container(
        decoration: BoxDecoration(
          color: tile.color,
          borderRadius: BorderRadius.circular(14),
          boxShadow: active
              ? [BoxShadow(color: tile.color.withOpacity(0.5), blurRadius: 0, spreadRadius: 3)]
              : const [BoxShadow(color: Color(0x24161310), blurRadius: 12, offset: Offset(0, 5))],
          border: active ? Border.all(color: Colors.white, width: 3) : null,
        ),
        padding: const EdgeInsets.all(13),
        child: Stack(children: [
          Positioned(top: 0, left: 0, child: Icon(tile.icon, color: Colors.white.withOpacity(0.9), size: 22)),
          Positioned(
            top: 0,
            right: 0,
            child: Container(
              constraints: const BoxConstraints(minWidth: 26),
              height: 26,
              padding: const EdgeInsets.symmetric(horizontal: 7),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.92), borderRadius: BorderRadius.circular(999)),
              child: Text('$count', style: TextStyle(color: tile.color, fontWeight: FontWeight.w900, fontSize: 13)),
            ),
          ),
          Align(
            alignment: Alignment.bottomLeft,
            child: Text(tile.label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
          ),
        ]),
      ),
    );
  }

  Widget _taskCard(TaskItem t) {
    final stripe = _statusColor[t.status] ?? kMute;
    final due = t.dueAt != null ? DateFormat('d MMM').format(DateTime.tryParse(t.dueAt!)?.toLocal() ?? DateTime.now()) : null;
    final meta = [
      if (t.clientName != null && t.clientName!.isNotEmpty) t.clientName,
      if (t.weighbridgeId != null && t.weighbridgeId!.isNotEmpty) t.weighbridgeId,
      t.unassigned ? 'Unassigned' : '→ ${t.assignedName}',
      if (due != null) (t.overdue ? 'due $due · overdue' : 'due $due'),
    ].where((e) => e != null).join(' · ');

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(kRadius), boxShadow: kSoftShadow),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(width: 5, color: stripe),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(t.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: kInk))),
                  _statusPill(t.status),
                ]),
                if (meta.isNotEmpty)
                  Padding(padding: const EdgeInsets.only(top: 6), child: Text(meta, style: TextStyle(fontSize: 12.5, color: t.overdue ? kFail : kMute))),
                const SizedBox(height: 10),
                Row(children: [
                  _actionButton(t),
                ]),
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _statusPill(String status) {
    final c = _statusColor[status] ?? kMute;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(999)),
      child: Text((_statusLabel[status] ?? status).toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.3)),
    );
  }

  // Quick status change — the backend authorises (manager or assignee); a 403
  // simply surfaces as a snackbar.
  Widget _actionButton(TaskItem t) {
    return PopupMenuButton<String>(
      onSelected: (s) => _setStatus(t, s),
      itemBuilder: (_) => [
        for (final e in _statusLabel.entries)
          if (e.key != t.status) PopupMenuItem(value: e.key, child: Text('Mark ${e.value}')),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(color: const Color(0xFFF3F0E8), borderRadius: BorderRadius.circular(8)),
        child: const Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.swap_horiz, size: 16, color: kCoal),
          SizedBox(width: 6),
          Text('Change status', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: kCoal)),
        ]),
      ),
    );
  }

  Widget _message(String t) => ListView(children: [
        Padding(
          padding: const EdgeInsets.only(top: 90),
          child: Center(child: Text(t, style: const TextStyle(color: kMute))),
        )
      ]);
}
