export function Button({ children, variant = "primary", className = "", ...props }) {
  const variants = {
    primary: "primary-button",
    secondary: "secondary-button",
    ghost: "ghost-button"
  };
  const base = variants[variant] ?? variants.primary;
  return (
    <button className={`${base} ${className}`} {...props}>
      {children}
    </button>
  );
}
