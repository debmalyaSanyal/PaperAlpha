import type { GeneratedPaper } from "@/types/paperalpha";

const encoder = new TextEncoder();

function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function uint16(value: number) {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function uint32(value: number) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraph(text: string, style?: string) {
  const styleXml = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${styleXml}<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
}

function tableXml(columns: string[], rows: string[][]) {
  const rowXml = [columns, ...rows].map((row) => `<w:tr>${row.map((cell) => `<w:tc><w:p><w:r><w:t>${xmlEscape(cell)}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>${rowXml}</w:tbl>`;
}

export function buildDocumentXml(paper: GeneratedPaper) {
  const body = [
    paragraph(paper.title, "Title"),
    paragraph("Authors: [Information not provided]"),
    paragraph("Abstract", "Heading1"),
    paragraph(paper.abstract),
    paragraph(`Keywords: ${paper.keywords.join(", ") || "[Information not provided]"}`),
    ...paper.sections.flatMap((section) => [
      paragraph(section.title, "Heading1"),
      ...section.content.split(/\n+/).filter(Boolean).map((line) => paragraph(line)),
    ]),
    ...paper.tables.flatMap((table) => [
      paragraph(table.title, "Heading1"),
      paragraph(table.caption),
      tableXml(table.columns, table.rows),
    ]),
    ...paper.figures.flatMap((figure, index) => [
      paragraph(`Figure ${index + 1}. ${figure.title}`, "Heading1"),
      paragraph(figure.caption),
    ]),
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`;
}

export function createDocx(paper: GeneratedPaper) {
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    },
    { name: "word/document.xml", content: buildDocumentXml(paper) },
  ];

  const localParts: number[] = [];
  const centralParts: number[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const content = encoder.encode(file.content);
    const crc = crc32(content);
    const localHeader = [
      ...uint32(0x04034b50), ...uint16(20), ...uint16(0), ...uint16(0), ...uint16(0), ...uint16(0),
      ...uint32(crc), ...uint32(content.length), ...uint32(content.length), ...uint16(name.length), ...uint16(0),
      ...name,
    ];
    localParts.push(...localHeader, ...content);
    const centralHeader = [
      ...uint32(0x02014b50), ...uint16(20), ...uint16(20), ...uint16(0), ...uint16(0), ...uint16(0), ...uint16(0),
      ...uint32(crc), ...uint32(content.length), ...uint32(content.length), ...uint16(name.length), ...uint16(0), ...uint16(0),
      ...uint16(0), ...uint16(0), ...uint32(0), ...uint32(offset), ...name,
    ];
    centralParts.push(...centralHeader);
    offset += localHeader.length + content.length;
  }

  const centralOffset = localParts.length;
  const end = [
    ...uint32(0x06054b50), ...uint16(0), ...uint16(0), ...uint16(files.length), ...uint16(files.length),
    ...uint32(centralParts.length), ...uint32(centralOffset), ...uint16(0),
  ];
  return Buffer.from([...localParts, ...centralParts, ...end]);
}
