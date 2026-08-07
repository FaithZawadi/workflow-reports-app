import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../session.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'quotation_detail_screen.dart';
import 'new_quotation_screen.dart';

// The quotations the signed-in user may see. Clients see their own; PM/TM/admin
// see all. Everyone can raise a new one (the server decides what that means).
class QuotationsListScreen extends StatefulWidget {
  const QuotationsListScreen({super.key});
  @override
  State<QuotationsListScreen> createState() => _QuotationsListScreenState();
}

class _QuotationsListScreenState extends State<QuotationsListScreen> {
  List<QuotationSummary>? _items;
  String? _err;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await context.read<Session>().api.getQuotations();
      if (mounted) setState(() { _items = list; _err = null; });
    } catch (e) {
      if (mounted) setState(() => _err = e.toString());
    }
  }

  bool get _isClient {
    final u = context.read<Session>().user;
    if (u == null) return false;
    final roles = u.roles.isNotEmpty ? u.roles : [u.role];
    return roles.length == 1 && roles.first == 'CLIENT';
  }

  Future<void> _openNew() async {
    final created = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => const NewQuotationScreen()));
    if (created == true) _load();
  }

  Future<void> _open(String id) async {
    final changed = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => QuotationDetailScreen(id: id)));
    if (changed == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Quotations')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openNew,
        backgroundColor: kGold,
        foregroundColor: kCoal,
        icon: const Icon(Icons.add),
        label: Text(_isClient ? 'Request a quote' : 'New quotation'),
      ),
      body: _err != null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_err!, style: const TextStyle(color: kFail))))
          : _items == null
              ? const Center(child: CircularProgressIndicator(color: kCoal))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _items!.isEmpty
                      ? ListView(children: const [
                          SizedBox(height: 120),
                          Center(child: Text('No quotations yet.', style: TextStyle(color: kMute))),
                        ])
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(14, 14, 14, 100),
                          itemCount: _items!.length,
                          itemBuilder: (_, i) => _card(_items![i]),
                        ),
                ),
    );
  }

  Widget _card(QuotationSummary q) {
    final color = kQuoteStatusColor[q.status] ?? kMute;
    final label = kQuoteStatusLabel[q.status] ?? q.status;
    final total = NumberFormat.currency(symbol: '${q.currency} ', decimalDigits: 0).format(q.grandTotal);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        onTap: () => _open(q.id),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Serial(q.number),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
              child: Text(label.toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.3)),
            ),
          ]),
          const SizedBox(height: 10),
          Text(q.clientName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: kInk)),
          const SizedBox(height: 2),
          Row(children: [
            Text(q.status == 'REQUESTED' ? 'Awaiting pricing' : total, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: q.status == 'REQUESTED' ? kMute : kInk)),
            const Spacer(),
            if (q.createdAt != null)
              Text(DateFormat('d MMM y').format(DateTime.tryParse(q.createdAt!)?.toLocal() ?? DateTime.now()), style: const TextStyle(fontSize: 12, color: kMute)),
          ]),
        ]),
      ),
    );
  }
}
