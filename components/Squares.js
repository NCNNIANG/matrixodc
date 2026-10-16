// Les quatre statuts, en petit : la signature visuelle de MatrixODC.
export default function Squares() {
  return (
    <span className="squares" aria-hidden="true">
      <i style={{ background: 'var(--todo)' }} />
      <i style={{ background: 'var(--doing)' }} />
      <i style={{ background: 'var(--blocked)' }} />
      <i style={{ background: 'var(--done)' }} />
    </span>
  );
}
