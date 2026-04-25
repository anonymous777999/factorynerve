export function exportRowsToCsv(headers: string[], rows: string[][]) {
  const escape = (value: string) => `"${String(value || "").replaceAll('"', '""')}"`;
  return [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((_, index) => escape(row[index] || "")).join(",")),
  ].join("\n");
}

export function exportRowsToMarkdown(headers: string[], rows: string[][]) {
  const sanitize = (value: string) => String(value || "").replaceAll("|", "\\|").replaceAll("\n", " ");
  const headerLine = `| ${headers.map(sanitize).join(" | ")} |`;
  const dividerLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${headers.map((_, index) => sanitize(row[index] || "")).join(" | ")} |`);
  return [headerLine, dividerLine, ...body].join("\n");
}

export function exportRowsToJson(headers: string[], rows: string[][]) {
  return JSON.stringify(
    rows.map((row) =>
      Object.fromEntries(headers.map((header, index) => [header || `column_${index + 1}`, row[index] || ""])),
    ),
    null,
    2,
  );
}

export async function buildStructuredPdfBlob(options: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = (autoTableModule.default ?? autoTableModule) as (
    doc: InstanceType<typeof jsPDF>,
    options: Record<string, unknown>,
  ) => void;
  const doc = new jsPDF({
    orientation: options.headers.length > 5 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  doc.setFontSize(15);
  doc.text(options.title || "OCR Review Export", 40, 40);
  autoTable(doc, {
    startY: 56,
    head: [options.headers],
    body: options.rows.map((row) => options.headers.map((_, index) => row[index] || "")),
    styles: {
      fontSize: 9,
      cellPadding: 5,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [15, 23, 42],
    },
    margin: { left: 32, right: 32, top: 56, bottom: 32 },
  });
  return doc.output("blob");
}
