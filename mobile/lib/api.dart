import 'dart:convert';
import 'package:http/http.dart' as http;

// Thrown for any non-2xx API response, carrying the server's message.
class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => message;
}

class AppUser {
  final String id, email, name, role;
  final List<String> roles;
  final String? clientId, clientName;
  AppUser({required this.id, required this.email, required this.name, required this.role, required this.roles, this.clientId, this.clientName});
  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: j['id'] ?? '',
        email: j['email'] ?? '',
        name: j['name'] ?? '',
        role: j['role'] ?? '',
        roles: (j['roles'] as List?)?.map((e) => e.toString()).toList() ?? [j['role']?.toString() ?? ''],
        clientId: j['clientId'],
        clientName: j['clientName'],
      );
  Map<String, dynamic> toJson() => {'id': id, 'email': email, 'name': name, 'role': role, 'roles': roles, 'clientId': clientId, 'clientName': clientName};
}

class ReportSummary {
  final String serial, template, templateName, status, clientName;
  final String? site, weighbridgeId, authorName, createdAt;
  ReportSummary.fromJson(Map<String, dynamic> j)
      : serial = j['serial'] ?? '',
        template = j['template'] ?? '',
        templateName = j['templateName'] ?? '',
        status = j['status'] ?? '',
        clientName = j['clientName'] ?? '',
        site = j['site'],
        weighbridgeId = j['weighbridgeId'],
        authorName = j['authorName'],
        createdAt = j['createdAt'];
}

class TaskItem {
  final String id, title, status;
  final String? description, priority, clientName, weighbridgeId, assignedName, assignedToId, project, dueAt;
  TaskItem.fromJson(Map<String, dynamic> j)
      : id = j['id'] ?? '',
        title = j['title'] ?? '',
        status = j['status'] ?? 'OPEN',
        description = j['description'],
        priority = j['priority'],
        clientName = j['clientName'],
        weighbridgeId = j['weighbridgeId'],
        assignedName = j['assignedName'],
        assignedToId = j['assignedToId'],
        project = j['project'],
        dueAt = j['dueAt'];

  bool get unassigned => (assignedName == null || assignedName!.isEmpty) && (assignedToId == null || assignedToId!.isEmpty);
  bool get overdue {
    if (dueAt == null || status == 'DONE') return false;
    final d = DateTime.tryParse(dueAt!);
    if (d == null) return false;
    final today = DateTime.now();
    return d.isBefore(DateTime(today.year, today.month, today.day));
  }
}

class TasksResult {
  final List<TaskItem> tasks;
  final bool canManage;
  TasksResult(this.tasks, this.canManage);
}

class ReviewerInfo {
  final String? supervisorEmail, supervisorName, managerEmail, managerName;
  ReviewerInfo.fromJson(Map<String, dynamic> j)
      : supervisorEmail = j['supervisorEmail'],
        supervisorName = j['supervisorName'],
        managerEmail = j['managerEmail'],
        managerName = j['managerName'];
}

class ReportDetail {
  final Map<String, dynamic> report;
  final ReviewerInfo reviewers;
  final String? actAs; // "SUPERVISOR" | "MANAGER" | null
  final bool canEdit;
  ReportDetail(this.report, this.reviewers, this.actAs, this.canEdit);
  factory ReportDetail.fromJson(Map<String, dynamic> j) => ReportDetail(
        Map<String, dynamic>.from(j['report'] ?? {}),
        ReviewerInfo.fromJson(Map<String, dynamic>.from(j['reviewers'] ?? {})),
        (j['permissions']?['actAs']),
        (j['permissions']?['canEdit'] ?? false) == true,
      );
}

class Person {
  final String id, name, email;
  Person.fromJson(Map<String, dynamic> j) : id = j['id'] ?? '', name = j['name'] ?? '', email = j['email'] ?? '';
}

class ApiClient {
  String baseUrl;
  String? token;
  ApiClient(this.baseUrl, {this.token});

  Map<String, String> get _headers => {
        'content-type': 'application/json',
        if (token != null) 'authorization': 'Bearer $token',
      };

  Uri _u(String path, [Map<String, String>? q]) => Uri.parse('$baseUrl$path').replace(queryParameters: q);

  dynamic _decode(http.Response r) {
    final body = r.body.isEmpty ? {} : jsonDecode(r.body);
    if (r.statusCode >= 200 && r.statusCode < 300) return body;
    final msg = (body is Map && body['error'] != null) ? body['error'].toString() : 'Request failed (${r.statusCode}).';
    throw ApiException(r.statusCode, msg);
  }

  Future<AppUser> login(String email, String password) async {
    final r = await http.post(_u('/api/auth/mobile-login'), headers: {'content-type': 'application/json'}, body: jsonEncode({'email': email, 'password': password}));
    final d = _decode(r);
    token = d['token'];
    return AppUser.fromJson(Map<String, dynamic>.from(d['user']));
  }

  Future<List<ReportSummary>> getReports({String? status, String? q}) async {
    final params = <String, String>{};
    if (status != null && status != 'all') params['status'] = status;
    if (q != null && q.trim().isNotEmpty) params['q'] = q.trim();
    final d = _decode(await http.get(_u('/api/reports', params.isEmpty ? null : params), headers: _headers));
    return ((d['reports'] as List?) ?? []).map((e) => ReportSummary.fromJson(Map<String, dynamic>.from(e))).toList();
  }

  Future<ReportDetail> getReport(String serial) async {
    final d = _decode(await http.get(_u('/api/reports/$serial'), headers: _headers));
    return ReportDetail.fromJson(Map<String, dynamic>.from(d));
  }

  Future<String> decide(String serial, String decision, String comment) async {
    final d = _decode(await http.post(_u('/api/reports/$serial/decision'), headers: _headers, body: jsonEncode({'decision': decision, 'comment': comment})));
    return d['status']?.toString() ?? '';
  }

  // Returns { templates: [...], allowed: [codes] }.
  Future<Map<String, dynamic>> getTemplates() async {
    final d = _decode(await http.get(_u('/api/templates'), headers: _headers));
    return Map<String, dynamic>.from(d);
  }

  Future<Map<String, List<Person>>> getDirectory() async {
    final d = _decode(await http.get(_u('/api/users/directory'), headers: _headers));
    List<Person> pick(String k) => ((d[k] as List?) ?? []).map((e) => Person.fromJson(Map<String, dynamic>.from(e))).toList();
    return {'supervisors': pick('supervisors'), 'managers': pick('managers')};
  }

  Future<List<String>> getClients() async {
    final d = _decode(await http.get(_u('/api/clients'), headers: _headers));
    return ((d['clients'] as List?) ?? []).map((e) => (e['name'] ?? '').toString()).where((s) => s.isNotEmpty).toList();
  }

  // Returns { serial } on success.
  Future<String> submitReport(Map<String, dynamic> payload) async {
    final d = _decode(await http.post(_u('/api/reports'), headers: _headers, body: jsonEncode(payload)));
    return d['serial']?.toString() ?? '';
  }

  // Role-scoped dashboard metrics.
  Future<Map<String, dynamic>> getStats() async {
    final d = _decode(await http.get(_u('/api/stats'), headers: _headers));
    return Map<String, dynamic>.from(d);
  }

  // Tasks assigned to the user (or all, for managers/admin).
  Future<TasksResult> getTasks() async {
    final d = _decode(await http.get(_u('/api/tasks'), headers: _headers));
    final list = ((d['tasks'] as List?) ?? []).map((e) => TaskItem.fromJson(Map<String, dynamic>.from(e))).toList();
    return TasksResult(list, d['canManage'] == true);
  }

  // Update a task's status (managers, or the task's assignee).
  Future<void> updateTaskStatus(String id, String status) async {
    _decode(await http.patch(_u('/api/tasks/$id'), headers: _headers, body: jsonEncode({'status': status})));
  }
}
