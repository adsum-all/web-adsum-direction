// File generation for the direction's exports, without an external library.
//
// A strict content policy blocks third-party scripts, so the usual spreadsheet and
// PDF packages are not an option. They are also not needed: Excel opens the
// SpreadsheetML written below with real columns and a bold header row, and PDF is
// the browser's own print pipeline, which additionally gives the reader a preview
// and a printer for the same click.

import { ApiError, apiBaseUrl } from "./api.js";

/** Escape for XML and HTML alike. Applied to every value that reaches a document. */
function ech(v: string): string {
  return v
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * An Excel workbook in SpreadsheetML 2003.
 *
 * Verbose next to a CSV, and worth it: numbers arrive as numbers rather than as text
 * Excel has to be told to convert, accents survive without anybody choosing an
 * encoding, and the header row is bold and frozen. A direction that has to repair a
 * file before reading it will stop exporting.
 */
export function versXlsXml(
  titre: string, colonnes: string[], lignes: string[][], contexte: string,
): string {
  const cellule = (v: string): string => {
    // A value that is entirely numeric, in French or plain notation, is written as a
    // number so a column can be summed on arrival.
    const normalise = v.replace(/\s/g, "").replace(",", ".").replace("%", "");
    const estNombre = normalise !== "" && Number.isFinite(Number(normalise));
    return estNombre
      ? `<Cell><Data ss:Type="Number">${ech(normalise)}</Data></Cell>`
      : `<Cell><Data ss:Type="String">${ech(v)}</Data></Cell>`;
  };
  const ligne = (cells: string) => `<Row>${cells}</Row>`;
  const corps = lignes.map((l) => ligne(l.map(cellule).join(""))).join("");
  const entete = ligne(colonnes.map((c) => `<Cell ss:StyleID="th"><Data ss:Type="String">${ech(c)}</Data></Cell>`).join(""));

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="th"><Font ss:Bold="1"/><Interior ss:Color="#EEF1F7" ss:Pattern="Solid"/></Style>
  <Style ss:ID="meta"><Font ss:Italic="1" ss:Color="#5B6480"/></Style>
 </Styles>
 <Worksheet ss:Name="${ech(titre.slice(0, 28) || "Rapport")}">
  <Table>
   ${ligne(`<Cell ss:StyleID="meta"><Data ss:Type="String">${ech(titre)}</Data></Cell>`)}
   ${ligne(`<Cell ss:StyleID="meta"><Data ss:Type="String">${ech(contexte)}</Data></Cell>`)}
   ${ligne("")}
   ${entete}
   ${corps}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane>
   <ActivePane>2</ActivePane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
}

/** CSV for whoever wants the raw rows. Semicolons and a BOM, so French Excel splits
 *  the columns and keeps the accents without anybody opening an import wizard. */
export function versCsv(colonnes: string[], lignes: string[][]): string {
  const champ = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const corps = [colonnes, ...lignes].map((l) => l.map(champ).join(";")).join("\r\n");
  return `﻿${corps}`;
}

export function telecharger(contenu: string, nom: string, type: string): void {
  const blob = new Blob([contenu], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoked on the next tick: released synchronously, the click may not have read it.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Print, which is also how a PDF is produced.
 *
 * Rendered into an isolated frame rather than the live page: printing the dashboard
 * itself would carry the navigation, the filter bar and the surrounding panels onto
 * the paper, and the reader would have to trim a report they did not assemble.
 */
export function imprimer(
  titre: string, colonnes: string[], lignes: string[][], contexte: string, horodatage: string,
): void {
  const cadre = document.createElement("iframe");
  cadre.setAttribute("aria-hidden", "true");
  cadre.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(cadre);
  const doc = cadre.contentDocument;
  if (!doc) { document.body.removeChild(cadre); return; }

  doc.open();
  doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${ech(titre)}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  body { font: 12px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #101427; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #5b6480; font-size: 11px; margin: 0 0 2px; }
  table { border-collapse: collapse; width: 100%; margin-top: 14px; }
  th, td { border: 1px solid #d8dde8; padding: 5px 8px; text-align: left; }
  th { background: #eef1f7; font-weight: 600; }
  td:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
</style></head><body>
<h1>${ech(titre)}</h1>
<p class="meta">${ech(horodatage)}</p>
<p class="meta">${ech(contexte)}</p>
<table><thead><tr>${colonnes.map((c) => `<th>${ech(c)}</th>`).join("")}</tr></thead>
<tbody>${lignes.map((l) => `<tr>${l.map((v) => `<td>${ech(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>
</body></html>`);
  doc.close();

  const lancer = () => {
    cadre.contentWindow?.focus();
    cadre.contentWindow?.print();
    window.setTimeout(() => { if (cadre.parentNode) document.body.removeChild(cadre); }, 1500);
  };
  if (doc.readyState === "complete") lancer();
  else cadre.onload = lancer;
}

/**
 * A chart as a PNG, rasterised from its own SVG.
 *
 * The stylesheet is not inlined, so the image carries the geometry and the colours
 * written on the elements themselves. That covers the curves, areas and markers,
 * which are the parts of a chart somebody pastes into a report.
 */
export async function versPng(svg: SVGSVGElement | null, nom: string): Promise<void> {
  if (!svg) return;
  const boite = svg.getBoundingClientRect();
  const largeur = Math.max(900, Math.round(boite.width));
  const hauteur = Math.max(300, Math.round(boite.height));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(largeur));
  clone.setAttribute("height", String(hauteur));

  const source = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;

  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Doubled so the image stays sharp in a document rather than blurring the
      // moment somebody enlarges it.
      canvas.width = largeur * 2;
      canvas.height = hauteur * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const lien = document.createElement("a");
          lien.href = URL.createObjectURL(blob);
          lien.download = nom;
          document.body.appendChild(lien);
          lien.click();
          document.body.removeChild(lien);
          window.setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
        }
        resolve();
      }, "image/png");
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}

export interface RapportEnvoi {
  destinataire: string;
  titre: string;
  colonnes: string[];
  lignes: string[][];
  contexte: string;
}

/** Send the report through the platform's communication channel, so the dispatch is
 *  logged and auditable rather than leaving through somebody's personal mailbox. */
export async function envoyerRapport(token: string, rapport: RapportEnvoi): Promise<void> {
  const res = await fetch(`${apiBaseUrl()}/api/v1/direction/rapport/envoyer`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(rapport),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const corps = (await res.json()) as { detail?: string };
      detail = typeof corps.detail === "string" ? corps.detail : "";
    } catch { detail = ""; }
    throw new ApiError(detail || "Envoi impossible", res.status);
  }
}
