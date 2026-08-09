// Répartition sur place / en ligne pour UNE activité.
// L'API ne donne pas la ventilation par activité - on la déduit en projetant
// le ratio global (présentiel / en ligne) sur les présents de l'activité.
// Le libellé indique explicitement qu'il s'agit d'une projection.

interface Props {
  presents: number;
  ratioPresentiel: number; // 0..1
  ratioEnLigne: number;    // 0..1
}

export function LiveModalityChart({ presents, ratioPresentiel, ratioEnLigne }: Props): JSX.Element {
  const total = ratioPresentiel + ratioEnLigne;
  const pOnsite = total > 0 ? ratioPresentiel / total : 0.5;
  const onsite = Math.round(presents * pOnsite);
  const online = Math.max(presents - onsite, 0);
  const pct = (n: number) => (presents > 0 ? Math.round((100 * n) / presents) : 0);

  if (presents === 0) {
    return (
      <div className="chart-empty" role="status">
        <span className="chart-empty-dot" aria-hidden="true" />
        <p>Aucun présent enregistré pour projeter la modalité.</p>
      </div>
    );
  }

  return (
    <div className="modality-wrap">
      <div className="modality-legend">
        <span className="modality-item">
          <i className="modality-dot modality-onsite" aria-hidden="true" />
          <span className="modality-label">Sur place</span>
          <b className="modality-value">{onsite.toLocaleString("fr-FR")}</b>
          <em className="modality-pct">{pct(onsite)}%</em>
        </span>
        <span className="modality-item">
          <i className="modality-dot modality-online" aria-hidden="true" />
          <span className="modality-label">En ligne</span>
          <b className="modality-value">{online.toLocaleString("fr-FR")}</b>
          <em className="modality-pct">{pct(online)}%</em>
        </span>
      </div>
      <div
        className="modality-bar"
        role="img"
        aria-label={`Sur place ${onsite}, en ligne ${online}`}
      >
        <div className="modality-seg modality-onsite" style={{ width: `${pct(onsite)}%` }}>
          {pct(onsite) >= 12 ? `${pct(onsite)}%` : ""}
        </div>
        <div className="modality-seg modality-online" style={{ width: `${pct(online)}%` }}>
          {pct(online) >= 12 ? `${pct(online)}%` : ""}
        </div>
      </div>
      <p className="modality-note">
        Projection appliquant le ratio global présentiel / en ligne aux présents de cette activité.
      </p>
    </div>
  );
}
