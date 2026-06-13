import type { SavedDesign } from '../data/types';

interface Props {
  designs: SavedDesign[];
  storageAvailable: boolean;
  canSave: boolean;
  onSave: () => void;
  onOpen: (d: SavedDesign) => void;
  onDelete: (id: string) => void;
}

export default function SavedDesigns({
  designs,
  storageAvailable,
  canSave,
  onSave,
  onOpen,
  onDelete,
}: Props) {
  return (
    <div className="panel">
      <h2>Saved designs</h2>
      <button className="primary" onClick={onSave} disabled={!storageAvailable || !canSave}>
        Save current design
      </button>
      {!storageAvailable && (
        <p className="notice">
          Browser storage is unavailable, so saving is disabled. Everything else still works.
        </p>
      )}

      {designs.length === 0 ? (
        <p className="notice">No saved designs yet.</p>
      ) : (
        <ul className="saved-list" style={{ marginTop: 12 }}>
          {designs.map((d) => (
            <li key={d.id}>
              <div>
                <div>{d.name}</div>
                <div className="meta">
                  {d.query} · {new Date(d.savedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="actions">
                <button onClick={() => onOpen(d)}>Open</button>
                <button onClick={() => onDelete(d.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
