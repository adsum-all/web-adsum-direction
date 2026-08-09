// Export a panel: preview first, then Excel, PDF, image or send.
//
// The preview is not a courtesy. An export leaves the platform and gets forwarded,
// printed and quoted, and a filtered table that does not carry its filters becomes a
// claim about the whole organisation the moment it is out of the building. So every
// route out passes through a screen showing exactly what will leave, filters
// included, and nothing downloads until somebody has seen it.
//
// No export library: a strict content policy blocks external scripts, and the two
// formats that matter are reachable without one. Excel reads the SpreadsheetML that
// is written here, and PDF is the browser's own print pipeline, which is also what
// gives the reader a print preview for free.

import { useMemo, useState } from "react";

import type { Filtres } from "../directionApi.js";
import { useDirection } from "../DirectionContext.js";
import { envoyerRapport } from "../directionExport.js";
import { versXlsXml, versCsv, telecharger, imprimer, versPng } from "../directionExport.js";

interface ExportProps {
  titre: string;
  colonnes: string[];
  lignesTableau: string[][];
  filtres: Filtres;
  /** Element to capture when exporting an image, typically the chart container. */
  cibleImage?: () => SVGSVGElement | null;
}

const ETIQUETTES: Record<string, string> = {
  coordination: "Coordination", intendance: "Intendance", commission: "Commission",
  tribu: "Tribu", volet: "Volet", evenement: "Activité", pays: "Pays",
  genre: "Genre", type_membre: "Statut de membre", depuis: "À partir du", jusqu_a: "Jusqu'au",
};

export function ExportBar({ titre, colonnes, lignesTableau, filtres, cibleImage }: ExportProps): JSX.Element {
  const { session } = useDirection();
  const [ouvert, setOuvert] = useState(false);
  const [destinataire, setDestinataire] = useState("");
  const [envoi, setEnvoi] = useState<{ etat: "repos" | "cours" | "ok" | "erreur"; message?: string }>({ etat: "repos" });

  // The filter set travels with the file. A table headed "Participation" that was
  // actually one coordination over one quarter is the export that misleads.
  const contexte = useMemo(
    () => Object.entries(filtres)
      .filter(([, v]) => v)
      .map(([k, v]) => `${ETIQUETTES[k] ?? k} : ${v}`),
    [filtres],
  );

  const horodatage = useMemo(() => new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long", timeStyle: "short",
  }).format(new Date()), []);

  const pied = contexte.length
    ? `Filtres appliqués - ${contexte.join(" ; ")}`
    : "Aucun filtre : périmètre complet.";

  function nomFichier(ext: string): string {
    const base = titre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `${base}-${new Date().toISOString().slice(0, 10)}.${ext}`;
  }

  async function envoyer(): Promise<void> {
    setEnvoi({ etat: "cours" });
    try {
      await envoyerRapport(session.token, {
        destinataire: destinataire.trim(),
        titre,
        colonnes,
        lignes: lignesTableau,
        contexte: pied,
      });
      setEnvoi({ etat: "ok", message: "Rapport transmis au canal de communication." });
    } catch (err) {
      setEnvoi({ etat: "erreur", message: err instanceof Error ? err.message : "Envoi impossible" });
    }
  }

  return (
    <div className="export">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOuvert(true)}>
        Exporter ou envoyer
      </button>

      {ouvert && (
        <div className="modale" role="dialog" aria-modal="true" aria-label={`Aperçu avant export : ${titre}`}>
          <div className="modale-fond" onClick={() => setOuvert(false)} aria-hidden="true" />
          <div className="modale-corps modale-large">
            <header className="modale-tete">
              <h2>Aperçu avant export</h2>
              <button type="button" className="btn-icone" onClick={() => setOuvert(false)} aria-label="Fermer">
                &times;
              </button>
            </header>

            <div className="apercu" id="apercu-export">
              <h3 className="apercu-titre">{titre}</h3>
              <p className="apercu-meta">{horodatage}</p>
              <p className="apercu-meta">{pied}</p>
              <div className="apercu-defilement">
                <table className="tableau">
                  <thead>
                    <tr>{colonnes.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {lignesTableau.slice(0, 200).map((l, i) => (
                      <tr key={i}>{l.map((v, j) => <td key={j}>{v}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lignesTableau.length > 200 && (
                <p className="muted small">
                  Aperçu limité à 200 lignes. Le fichier exporté contient les {lignesTableau.length} lignes.
                </p>
              )}
            </div>

            <footer className="modale-pied">
              <div className="modale-actions">
                <button
                  type="button" className="btn btn-primary"
                  onClick={() => telecharger(versXlsXml(titre, colonnes, lignesTableau, pied), nomFichier("xls"), "application/vnd.ms-excel")}
                >
                  Excel
                </button>
                <button
                  type="button" className="btn"
                  onClick={() => imprimer(titre, colonnes, lignesTableau, pied, horodatage)}
                >
                  PDF ou impression
                </button>
                <button
                  type="button" className="btn"
                  onClick={() => telecharger(versCsv(colonnes, lignesTableau), nomFichier("csv"), "text/csv;charset=utf-8")}
                >
                  CSV
                </button>
                {cibleImage && (
                  <button
                    type="button" className="btn"
                    onClick={() => { void versPng(cibleImage(), nomFichier("png")); }}
                  >
                    Image
                  </button>
                )}
              </div>

              <form
                className="modale-envoi"
                onSubmit={(e) => { e.preventDefault(); void envoyer(); }}
              >
                <label htmlFor="export-destinataire">
                  <span>Envoyer par courriel</span>
                  <input
                    id="export-destinataire" type="email" required
                    placeholder="destinataire@exemple.org"
                    value={destinataire}
                    onChange={(e) => setDestinataire(e.target.value)}
                  />
                </label>
                <button type="submit" className="btn" disabled={envoi.etat === "cours"}>
                  {envoi.etat === "cours" ? "Envoi..." : "Envoyer"}
                </button>
              </form>
              {envoi.message && (
                <p className={`small ${envoi.etat === "ok" ? "texte-ok" : "texte-alerte"}`}>{envoi.message}</p>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
