import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:open_filex/open_filex.dart';
import 'package:share_plus/share_plus.dart';
import '../session.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';

final _money = NumberFormat('#,##0.00');

class QuotationDetailScreen extends StatefulWidget {
  final String id;
  const QuotationDetailScreen({super.key, required this.id});
  @override
  State<QuotationDetailScreen> createState() => _QuotationDetailScreenState();
}

// One editable line item, backed by persistent controllers so the cursor never
// jumps while the live totals recompute.
class _Item {
  final TextEditingController desc, qty, unit, price;
  _Item({String description = '', String qty = '1', String unit = 'EA', String price = '0'})
      : desc = TextEditingController(text: description),
        qty = TextEditingController(text: qty),
        unit = TextEditingController(text: unit),
        price = TextEditingController(text: price);
  double get amount => (double.tryParse(qty.text) ?? 0) * (double.tryParse(price.text) ?? 0);
  void dispose() { desc.dispose(); qty.dispose(); unit.dispose(); price.dispose(); }
}

class _QuotationDetailScreenState extends State<QuotationDetailScreen> {
  QuotationDetailData? _data;
  String? _err;
  bool _busy = false, _pdfBusy = false, _changed = false;

  // Staff editor state
  final List<_Item> _items = [];
  final _vat = TextEditingController(text: '16');
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _subject = TextEditingController();
  String _currency = 'KES';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final it in _items) it.dispose();
    _vat.dispose(); _email.dispose(); _phone.dispose(); _subject.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = await context.read<Session>().api.getQuotation(widget.id);
      final q = d.quotation;
      for (final it in _items) it.dispose();
      _items
        ..clear()
        ..addAll(((q['items'] as List?) ?? []).map((e) => _Item(
              description: '${e['description'] ?? ''}',
              qty: '${e['qty'] ?? 1}',
              unit: '${e['unit'] ?? 'EA'}',
              price: '${e['unitPrice'] ?? 0}',
            )));
      if (_items.isEmpty) _items.add(_Item());
      _vat.text = '${q['vatRate'] ?? 16}';
      _currency = '${q['currency'] ?? 'KES'}';
      _email.text = '${q['contactEmail'] ?? ''}';
      _phone.text = '${q['contactPhone'] ?? ''}';
      _subject.text = '${q['subject'] ?? ''}';
      if (mounted) setState(() { _data = d; _err = null; });
    } catch (e) {
      if (mounted) setState(() => _err = e.toString());
    }
  }

  double get _subtotal => _items.fold(0.0, (a, it) => a + it.amount);
  double get _vatAmount => _subtotal * (double.tryParse(_vat.text) ?? 0) / 100;
  double get _grand => _subtotal + _vatAmount;

  Future<File> _pdfFile() async {
    final bytes = await context.read<Session>().api.getQuotationPdf(widget.id);
    final dir = await getTemporaryDirectory();
    final num = '${_data?.quotation['number'] ?? widget.id}'.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final f = File('${dir.path}/$num.pdf');
    await f.writeAsBytes(bytes, flush: true);
    return f;
  }

  Future<void> _openPdf() async {
    setState(() => _pdfBusy = true);
    try {
      final f = await _pdfFile();
      final res = await OpenFilex.open(f.path);
      if (res.type != ResultType.done && mounted) showError(context, 'No PDF viewer found — use Share to save it instead.');
    } catch (e) {
      if (mounted) showError(context, e.toString());
    } finally {
      if (mounted) setState(() => _pdfBusy = false);
    }
  }

  Future<void> _sharePdf() async {
    setState(() => _pdfBusy = true);
    try {
      final f = await _pdfFile();
      await Share.shareXFiles([XFile(f.path, mimeType: 'application/pdf')], subject: '${_data?.quotation['number'] ?? 'Quotation'}.pdf');
    } catch (e) {
      if (mounted) showError(context, e.toString());
    } finally {
      if (mounted) setState(() => _pdfBusy = false);
    }
  }

  Future<void> _decide(String decision) async {
    setState(() => _busy = true);
    try {
      await context.read<Session>().api.patchQuotation(widget.id, {'clientDecision': decision});
      _changed = true;
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Quotation ${decision.toLowerCase()}'), backgroundColor: decision == 'ACCEPTED' ? kPass : kFail));
    } catch (e) {
      if (mounted) showError(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save({required bool issue}) async {
    final clean = _items.where((it) => it.desc.text.trim().isNotEmpty).map((it) => {
          'description': it.desc.text.trim(),
          'qty': double.tryParse(it.qty.text) ?? 0,
          'unit': it.unit.text.trim().isEmpty ? 'EA' : it.unit.text.trim(),
          'unitPrice': double.tryParse(it.price.text) ?? 0,
        }).toList();
    if (issue && clean.isEmpty) return showError(context, 'Add at least one line item before issuing.');
    if (issue && !RegExp(r'\S+@\S+\.\S+').hasMatch(_email.text.trim())) return showError(context, "Add the client's email so the quotation can be sent.");
    setState(() => _busy = true);
    try {
      await context.read<Session>().api.patchQuotation(widget.id, {
        'items': clean,
        'vatRate': double.tryParse(_vat.text) ?? 16,
        'currency': _currency,
        'contactEmail': _email.text.trim(),
        'contactPhone': _phone.text.trim(),
        'subject': _subject.text.trim(),
        'issue': issue,
      });
      _changed = true;
      await _load();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(issue ? 'Issued to client' : 'Draft saved'), backgroundColor: kPass));
    } catch (e) {
      if (mounted) showError(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async { Navigator.pop(context, _changed); return false; },
      child: Scaffold(
        appBar: AppBar(
          title: Text('${_data?.quotation['number'] ?? 'Quotation'}'),
          actions: [
            if (_data != null && _data!.quotation['status'] != 'REQUESTED')
              _pdfBusy
                  ? const Padding(padding: EdgeInsets.all(16), child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)))
                  : PopupMenuButton<String>(
                      icon: const Icon(Icons.picture_as_pdf_outlined),
                      onSelected: (v) => v == 'open' ? _openPdf() : _sharePdf(),
                      itemBuilder: (_) => const [
                        PopupMenuItem(value: 'open', child: Text('Open PDF')),
                        PopupMenuItem(value: 'share', child: Text('Share PDF')),
                      ],
                    ),
          ],
        ),
        body: _err != null
            ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_err!, style: const TextStyle(color: kFail))))
            : _data == null
                ? const Center(child: CircularProgressIndicator(color: kCoal))
                : _content(),
      ),
    );
  }

  Widget _content() {
    final q = _data!.quotation;
    final status = '${q['status']}';
    final editable = _data!.canPrepare && (status == 'REQUESTED' || status == 'QUOTED');
    final hasItems = (q['items'] as List?)?.isNotEmpty == true;
    final color = kQuoteStatusColor[status] ?? kMute;
    final label = kQuoteStatusLabel[status] ?? status;

    return ListView(padding: const EdgeInsets.fromLTRB(14, 14, 14, 40), children: [
      Row(children: [
        Expanded(child: Text('${q['clientName'] ?? ''}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: kInk))),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3)),
          child: Text(label.toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
        ),
      ]),
      const SizedBox(height: 4),
      Text([
        if ((q['contactPerson'] ?? '').toString().isNotEmpty) '${q['contactPerson']}',
        if ((q['contactEmail'] ?? '').toString().isNotEmpty) '${q['contactEmail']}',
        if ((q['contactPhone'] ?? '').toString().isNotEmpty) '${q['contactPhone']}',
      ].join(' · '), style: const TextStyle(color: kMute, fontSize: 13)),
      if ((q['subject'] ?? '').toString().isNotEmpty) ...[
        const SizedBox(height: 6),
        Text('${q['subject']}', style: const TextStyle(color: kInk, fontSize: 14, fontWeight: FontWeight.w700)),
      ],
      if ((q['requestNote'] ?? '').toString().isNotEmpty) ...[
        const SizedBox(height: 10),
        AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('REQUEST', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: kMute)),
          const SizedBox(height: 4),
          Text('${q['requestNote']}', style: const TextStyle(fontSize: 14, color: kInk)),
        ])),
      ],

      if (editable) _editor(q) else _readView(q, hasItems),

      // Client accept / decline
      if (_data!.canDecide) ...[
        const SectionBar('Your decision'),
        Row(children: [
          Expanded(child: ElevatedButton(
            onPressed: _busy ? null : () => _decide('ACCEPTED'),
            style: ElevatedButton.styleFrom(backgroundColor: kPass, foregroundColor: Colors.white),
            child: const Text('Accept'),
          )),
          const SizedBox(width: 10),
          Expanded(child: ElevatedButton(
            onPressed: _busy ? null : () => _decide('DECLINED'),
            style: ElevatedButton.styleFrom(backgroundColor: kFail, foregroundColor: Colors.white),
            child: const Text('Decline'),
          )),
        ]),
      ],
    ]);
  }

  // ---- Read-only view ----
  Widget _readView(Map<String, dynamic> q, bool hasItems) {
    final cur = '${q['currency'] ?? 'KES'}';
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (hasItems) ...[
        const SectionBar('Line items'),
        for (final it in (q['items'] as List))
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${it['description']}', style: const TextStyle(fontSize: 14, color: kInk, fontWeight: FontWeight.w600)),
                Text('${it['qty']} ${it['unit'] ?? 'EA'} × ${_money.format(double.tryParse('${it['unitPrice']}') ?? 0)}', style: const TextStyle(fontSize: 12, color: kMute)),
              ])),
              const SizedBox(width: 8),
              Text(_money.format((double.tryParse('${it['qty']}') ?? 0) * (double.tryParse('${it['unitPrice']}') ?? 0)), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: kInk)),
            ]),
          ),
        const Divider(),
        _totalLine('Subtotal', '$cur ${_money.format(double.tryParse('${q['subtotal']}') ?? 0)}'),
        _totalLine('VAT (${q['vatRate'] ?? 0}%)', '$cur ${_money.format(double.tryParse('${q['vatAmount']}') ?? 0)}'),
        _totalLine('Grand total', '$cur ${_money.format(double.tryParse('${q['grandTotal']}') ?? 0)}', strong: true),
        if ((q['amountInWords'] ?? '').toString().isNotEmpty)
          Padding(padding: const EdgeInsets.only(top: 4), child: Text('${q['amountInWords']}', style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: kMute))),
      ] else if ('${q['status']}' == 'REQUESTED')
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 20),
          child: Center(child: Text('Awaiting pricing from QSL.', style: TextStyle(color: kMute))),
        ),
      if ((q['paymentDetails'] ?? '').toString().isNotEmpty) ...[
        const SectionBar('Payment details'),
        Text('${q['paymentDetails']}', style: const TextStyle(fontSize: 13, color: kInk, height: 1.5, fontFamily: 'monospace')),
      ],
      if ((q['terms'] ?? '').toString().isNotEmpty) ...[
        const SectionBar('Terms of sale'),
        Text('${q['terms']}', style: const TextStyle(fontSize: 13, color: kInk, height: 1.4)),
      ],
    ]);
  }

  Widget _totalLine(String k, String v, {bool strong = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [
          Text('$k  ', style: TextStyle(fontSize: strong ? 15 : 13, fontWeight: strong ? FontWeight.w900 : FontWeight.w700, color: kMute)),
          Text(v, style: TextStyle(fontSize: strong ? 16 : 14, fontWeight: strong ? FontWeight.w900 : FontWeight.w700, color: kInk)),
        ]),
      );

  // ---- Staff editor ----
  Widget _editor(Map<String, dynamic> q) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SectionBar('Client contact'),
      _labeled('Client email (needed to issue)', TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(hintText: 'client@company.com'))),
      _labeled('Client phone', TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(hintText: '+254 7XX XXX XXX'))),
      _labeled('Subject / job', TextField(controller: _subject, decoration: const InputDecoration(hintText: 'e.g. Calibration & verification of weighbridge'))),

      const SectionBar('Line items'),
      for (int i = 0; i < _items.length; i++) _itemRow(i),
      Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(onPressed: () => setState(() => _items.add(_Item())), icon: const Icon(Icons.add), label: const Text('Add line')),
      ),

      Row(children: [
        Expanded(child: _labeled('Currency', DropdownButtonFormField<String>(
          value: _currency,
          items: const [DropdownMenuItem(value: 'KES', child: Text('KES')), DropdownMenuItem(value: 'USD', child: Text('USD')), DropdownMenuItem(value: 'EUR', child: Text('EUR')), DropdownMenuItem(value: 'GBP', child: Text('GBP'))],
          onChanged: (v) => setState(() => _currency = v ?? 'KES'),
        ))),
        const SizedBox(width: 10),
        Expanded(child: _labeled('VAT rate (%)', TextField(controller: _vat, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {})))),
      ]),

      const SizedBox(height: 6),
      _totalLine('Subtotal', '$_currency ${_money.format(_subtotal)}'),
      _totalLine('VAT', '$_currency ${_money.format(_vatAmount)}'),
      _totalLine('Grand total', '$_currency ${_money.format(_grand)}', strong: true),

      const SizedBox(height: 14),
      Row(children: [
        Expanded(child: OutlinedButton(onPressed: _busy ? null : () => _save(issue: false), child: const Text('Save draft'))),
        const SizedBox(width: 10),
        Expanded(child: ElevatedButton(onPressed: _busy ? null : () => _save(issue: true), child: Text('${q['status']}' == 'QUOTED' ? 'Re-issue' : 'Issue'))),
      ]),
    ]);
  }

  Widget _itemRow(int i) {
    final it = _items[i];
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: kLine)),
      child: Column(children: [
        Row(children: [
          Expanded(child: TextField(controller: it.desc, decoration: const InputDecoration(hintText: 'Description', isDense: true))),
          IconButton(onPressed: _items.length <= 1 ? null : () => setState(() => _items.removeAt(i).dispose()), icon: const Icon(Icons.close, color: kFail, size: 20)),
        ]),
        const SizedBox(height: 6),
        Row(children: [
          Expanded(child: TextField(controller: it.qty, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Qty', isDense: true), onChanged: (_) => setState(() {}))),
          const SizedBox(width: 6),
          Expanded(child: TextField(controller: it.unit, decoration: const InputDecoration(labelText: 'Unit', isDense: true))),
          const SizedBox(width: 6),
          Expanded(flex: 2, child: TextField(controller: it.price, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Unit price', isDense: true), onChanged: (_) => setState(() {}))),
        ]),
        const SizedBox(height: 4),
        Align(alignment: Alignment.centerRight, child: Text('= ${_money.format(it.amount)}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kInk))),
      ]),
    );
  }

  Widget _labeled(String label, Widget child) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: kMute)),
          const SizedBox(height: 4),
          child,
        ]),
      );
}
