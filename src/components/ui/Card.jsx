export function Card({ children, className = "", ...props }) {
  return (
    <div className={`card-surface card-blur ${className}`} {...props}>
      {children}
    </div>
  );
}
