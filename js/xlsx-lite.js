/* مولّد xlsx خفيف بلا مكتبات (ZIP بدون ضغط) — يدعم RTL وعرض الأعمدة وتنسيق الأرقام.
   Xlsx.download(filename, { sheet, cols:[عرض...], rows:[[خلية...]] , merges:["A1:E1"] })
   الخلية: قيمة (نص/رقم) أو { v, s } حيث s ∈ title | head | text | num | date | boldtext | boldnum */
(function () {
  var STY = { title: 6, head: 1, num: 2, text: 3, boldtext: 4, boldnum: 5, date: 7 };
  var crcT = null;
  function crc32(b) {
    if (!crcT) { crcT = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } }
    var x = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) x = crcT[(x ^ b[i]) & 255] ^ (x >>> 8);
    return (x ^ 0xFFFFFFFF) >>> 0;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); }
  function col(i) { var s = ""; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true);
      h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, csize, true); e.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00;[Red]-#,##0.00"/></numFmts>' +
    '<fonts count="4"><font><sz val="11"/><name val="Cairo"/></font><font><b/><sz val="11"/><name val="Cairo"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Cairo"/></font><font><b/><sz val="14"/><color rgb="FF182763"/><name val="Cairo"/></font></fonts>' +
    '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF182763"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEEF3FF"/></patternFill></fill></fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFD3DAEA"/></left><right style="thin"><color rgb="FFD3DAEA"/></right><top style="thin"><color rgb="FFD3DAEA"/></top><bottom style="thin"><color rgb="FFD3DAEA"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="8">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
    '<xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function build(o) {
    var rowsXml = "";
    o.rows.forEach(function (row, ri) {
      var cells = "";
      row.forEach(function (c, ci) {
        if (c == null) return;
        var v = c, s = "text";
        if (typeof c === "object") { v = c.v; s = c.s || (typeof c.v === "number" ? "num" : "text"); }
        else if (typeof c === "number") s = "num";
        if (v == null || v === "") { cells += '<c r="' + col(ci) + (ri + 1) + '" s="' + STY[s] + '"/>'; return; }
        var ref = col(ci) + (ri + 1);
        if (typeof v === "number" && isFinite(v)) cells += '<c r="' + ref + '" s="' + STY[s] + '"><v>' + v + '</v></c>';
        else cells += '<c r="' + ref + '" s="' + STY[s] + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
      });
      rowsXml += '<row r="' + (ri + 1) + '">' + cells + "</row>";
    });
    var cols = (o.cols || []).map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join("");
    var merges = (o.merges || []).length ? '<mergeCells count="' + o.merges.length + '">' + o.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join("") + "</mergeCells>" : "";
    var sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/>' +
      (cols ? "<cols>" + cols + "</cols>" : "") + "<sheetData>" + rowsXml + "</sheetData>" + merges +
      '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToHeight="0"/></worksheet>';
    var name = esc((o.sheet || "Sheet1").replace(/[\\\/\?\*\[\]:]/g, " ").slice(0, 31));
    return zip([
      { name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: "_rels/.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: "xl/workbook.xml", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + name + '" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { name: "xl/_rels/workbook.xml.rels", data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: "xl/styles.xml", data: STYLES },
      { name: "xl/worksheets/sheet1.xml", data: sheet },
    ]);
  }
  function download(filename, o) {
    var blob = build(o), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- قراءة xlsx (الورقة الأولى) — تتطلب DecompressionStream (Chrome 80+/Safari 16.4+/Firefox 113+) ---------- */
  function unesc(t) {
    return String(t).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); }).replace(/&#x([0-9a-f]+);/gi, function (m, n) { return String.fromCharCode(parseInt(n, 16)); }).replace(/&amp;/g, "&");
  }
  async function inflate(raw) {
    if (typeof DecompressionStream === "undefined") throw new Error("المتصفح لا يدعم قراءة xlsx — استخدم ملف CSV أو متصفحًا أحدث");
    var st = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(st).arrayBuffer());
  }
  function colIdx(ref) { var m = /^([A-Z]+)/.exec(ref), n = 0; for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64); return n - 1; }
  async function read(file) {
    var buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer, buf.byteOffset, buf.length), i;
    for (i = buf.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) break;
    if (i < 0) throw new Error("الملف ليس xlsx صالحًا");
    var cnt = dv.getUint16(i + 10, true), p = dv.getUint32(i + 16, true), dec = new TextDecoder("utf-8"), entries = {};
    for (var n = 0; n < cnt; n++) {
      var nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      entries[dec.decode(buf.subarray(p + 46, p + 46 + nl))] = { method: dv.getUint16(p + 10, true), csize: dv.getUint32(p + 20, true), lho: dv.getUint32(p + 42, true) };
      p += 46 + nl + el + cl;
    }
    async function text(name) {
      var e = entries[name]; if (!e) return null;
      var start = e.lho + 30 + dv.getUint16(e.lho + 26, true) + dv.getUint16(e.lho + 28, true), raw = buf.subarray(start, start + e.csize);
      return dec.decode(e.method === 0 ? raw : await inflate(raw));
    }
    var shared = [], ss = await text("xl/sharedStrings.xml");
    if (ss) (ss.match(/<si[ >][\s\S]*?<\/si>|<si\/>/g) || []).forEach(function (si) {
      var out = ""; (si.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).forEach(function (t) { out += unesc(t.replace(/<[^>]+>/g, "")); }); shared.push(out);
    });
    var sheetPath = "xl/worksheets/sheet1.xml", wb = await text("xl/workbook.xml"), rels = await text("xl/_rels/workbook.xml.rels");
    if (wb && rels) {
      var rid = (/<sheet [^>]*r:id="([^"]+)"/.exec(wb) || [])[1];
      var rm = rid && new RegExp('<Relationship [^>]*Id="' + rid + '"[^>]*>').exec(rels);
      var tg = rm && /Target="([^"]+)"/.exec(rm[0]);
      if (tg) sheetPath = tg[1].charAt(0) === "/" ? tg[1].slice(1) : "xl/" + tg[1];
    }
    var xml = await text(sheetPath);
    if (!xml) throw new Error("لا توجد ورقة بيانات في الملف");
    var rows = [];
    (xml.match(/<row[ >][\s\S]*?<\/row>/g) || []).forEach(function (rx) {
      var rn = +(/ r="(\d+)"/.exec(rx) || [0, rows.length + 1])[1], row = [];
      (rx.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []).forEach(function (cx) {
        var ref = /r="([A-Z]+\d+)"/.exec(cx); if (!ref) return;
        var t = (/ t="([^"]+)"/.exec(cx) || [])[1], v = (/<v[^>]*>([\s\S]*?)<\/v>/.exec(cx) || [])[1], val = "";
        if (t === "inlineStr") val = unesc((cx.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).map(function (x) { return x.replace(/<[^>]+>/g, ""); }).join(""));
        else if (v != null) { if (t === "s") val = shared[+v] || ""; else if (t === "str" || t === "e") val = unesc(v); else if (t === "b") val = v === "1"; else val = isNaN(+v) ? unesc(v) : +v; }
        row[colIdx(ref[1])] = val;
      });
      for (var k = 0; k < row.length; k++) if (row[k] === undefined) row[k] = "";
      rows[rn - 1] = row;
    });
    for (var r = 0; r < rows.length; r++) if (!rows[r]) rows[r] = [];
    return rows;
  }
  // رقم تسلسلي في Excel → YYYY-MM-DD
  function serialToISO(n) { var d = new Date(Math.round((Number(n) - 25569) * 86400000)); return isNaN(d) ? "" : d.toISOString().slice(0, 10); }
  window.Xlsx = { build: build, download: download, read: read, serialToISO: serialToISO };
})();
