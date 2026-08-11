/**
 * Soft enter for page swaps — keeps shell stable, content eases in.
 */
export default function MainTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="animate-page-in">{children}</div>;
}
