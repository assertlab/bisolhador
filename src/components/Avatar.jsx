// A person's picture, or their initials when there is none: GitLab commits
// carry no account (no avatar), and GitHub commits whose e-mail isn't linked to
// an account don't either. An empty <img src> showed a broken image.
const initialsOf = (name) => String(name ?? '')
  .split(/[\s._@-]+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0].toUpperCase())
  .join('') || '?';

export function Avatar({ src, name, className = '', style, alt = '' }) {
  if (src) return <img className={`rounded-full ${className}`} src={src} alt={alt} style={style} />;
  return (
    <span
      aria-hidden={alt === '' ? 'true' : undefined}
      role={alt === '' ? undefined : 'img'}
      aria-label={alt || undefined}
      className={`rounded-full inline-flex items-center justify-center bg-gray-200 text-gray-600 dark:bg-slate-600 dark:text-slate-200 text-xs font-semibold select-none ${className}`}
      style={style}
    >
      {initialsOf(name)}
    </span>
  );
}
