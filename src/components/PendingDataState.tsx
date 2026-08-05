// Explicit placeholder shown when an indicator requires a backend field that
// the current API does not expose yet. Keeps statistical neutrality: never
// invent a value, always say which source is missing.

export function PendingDataState({
  title,
  needs,
  note,
}: {
  title: string;
  needs: string;
  note?: string;
}): JSX.Element {
  return (
    <div className="state state-pending" role="status">
      <p className="state-title">{title}</p>
      <p className="state-desc"><b>Donnée requise :</b> {needs}</p>
      {note && <p className="state-desc">{note}</p>}
    </div>
  );
}
