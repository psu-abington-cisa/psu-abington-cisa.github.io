#!/usr/bin/env node
// Unit tests for the pure helpers in assets/js/app.js. No dependencies.
// Usage: node scripts/test-app.js
'use strict';

var assert = require('assert');
var app = require('../assets/js/app.js');

var failures = 0;
function test(name, fn) {
  try { fn(); console.log('ok   ' + name); }
  catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + e.message); }
}

test('escapeHtml escapes markup and quotes', function () {
  assert.strictEqual(app.escapeHtml('<img src=x onerror="a(\'b\')">&'),
    '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
  assert.strictEqual(app.escapeHtml(null), '');
});

test('safeHttpUrl only accepts http(s)', function () {
  assert.strictEqual(app.safeHttpUrl('https://psu.mediaspace.kaltura.com/media/1_abc'), 'https://psu.mediaspace.kaltura.com/media/1_abc');
  assert.strictEqual(app.safeHttpUrl('http://example.com'), 'http://example.com');
  ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', '//evil.com',
    'ftp://x', '', null, 42, 'https://a b', ' javascript:alert(1)'].forEach(function (u) {
    assert.strictEqual(app.safeHttpUrl(u), '', String(u));
  });
});

test('safePdfPath only accepts presentations/*.pdf', function () {
  assert.strictEqual(app.safePdfPath('presentations/come-hack-09-17-2026.pdf'), 'presentations/come-hack-09-17-2026.pdf');
  ['presentations/../index.html', 'presentations/../x.pdf', '/etc/passwd.pdf', 'https://x/y.pdf',
    'javascript:alert(1)//.pdf', 'presentations/a"onload=x.pdf', 'other/a.pdf', ''].forEach(function (p) {
    assert.strictEqual(app.safePdfPath(p), '', p);
  });
});

test('parseDate is local and rejects impossible dates', function () {
  var d = app.parseDate('2026-09-17');
  assert.deepStrictEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 8, 17]);
  assert.strictEqual(app.parseDate('2026-02-30'), null);
  assert.strictEqual(app.fmtDate('2026-09-17'), 'Thursday, September 17, 2026');
});

test('normalize drops bad entries and unsafe links; sort is newest first', function () {
  var list = app.sortNewestFirst(app.normalize({ presentations: [
    { id: 'a', title: 'A', date: '2026-09-17', session: 1, pdf: 'presentations/a.pdf', kaltura: 'javascript:alert(1)' },
    { id: 'b', title: 'B', date: '2026-10-01', session: 2, pdf: '../b.pdf', kaltura: 'https://k/x' },
    { title: 'no id' }, null, 'str'
  ] }));
  assert.deepStrictEqual(list.map(function (p) { return p.id; }), ['b', 'a']);
  assert.strictEqual(list[1].kaltura, '');
  assert.strictEqual(list[0].pdf, '');
  assert.strictEqual(list[0].kaltura, 'https://k/x');
});

test('matches searches title, date and session', function () {
  var p = { title: 'Web Hacking 101', date: '2026-09-17', session: 3, kaltura: '' };
  assert.ok(app.matches(p, 'web'));
  assert.ok(app.matches(p, 'sep 17'));
  assert.ok(app.matches(p, 'session 3'));
  assert.ok(app.matches(p, '2026-09'));
  assert.ok(!app.matches(p, 'forensics'));
  assert.ok(app.matches(p, '   '));
});

test('safePdfPath allows subdirectories, spaces and .PDF; rejects traversal and other dirs', function () {
  assert.strictEqual(app.safePdfPath('presentations/sub/dir/file.pdf'), 'presentations/sub/dir/file.pdf');
  assert.strictEqual(app.safePdfPath('presentations/my file.PDF'), 'presentations/my file.PDF');
  assert.strictEqual(app.safePdfPath('presentations/../x.pdf'), '');
  assert.strictEqual(app.safePdfPath('other/x.pdf'), '');
});

test('matches requires every word; "recording" matches only entries with a kaltura link', function () {
  var noRec = { title: 'Web Hacking 101', date: '2026-09-17', session: 3, kaltura: '' };
  var withRec = { title: 'Web Hacking 101', date: '2026-09-17', session: 3, kaltura: 'https://k/x' };
  assert.ok(!app.matches(noRec, 'web forensics'));
  assert.ok(app.matches(withRec, 'recording'));
  assert.ok(!app.matches(noRec, 'recording'));
});

test('sortNewestFirst breaks same-date ties by higher session first', function () {
  var list = app.sortNewestFirst([
    { id: 's1', date: '2026-09-17', session: 1 },
    { id: 's2', date: '2026-09-17', session: 2 }
  ]);
  assert.deepStrictEqual(list.map(function (p) { return p.id; }), ['s2', 's1']);
});

test('normalize returns an empty array for missing or malformed data', function () {
  assert.deepStrictEqual(app.normalize(null), []);
  assert.deepStrictEqual(app.normalize({}), []);
  assert.deepStrictEqual(app.normalize({ presentations: 'x' }), []);
});

test('fmtDate returns an unparseable string unchanged', function () {
  assert.strictEqual(app.fmtDate('not a date'), 'not a date');
  assert.strictEqual(app.fmtDate('2026-02-30'), '2026-02-30');
});

if (failures) { console.log('\n' + failures + ' test(s) failed'); process.exit(1); }
console.log('\nAll tests passed.');
