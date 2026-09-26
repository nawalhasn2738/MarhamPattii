export function SafetyNote({
  children = "We only pass on what you said. We do not give medical advice.",
}: {
  children?: React.ReactNode;
}) {
  return <p className="note">{children}</p>;
}
