interface MusicBrainzLinkProps {
  releaseMbId: string | null | undefined;
  children: React.ReactNode;
}

export default function MusicBrainzLink({
  releaseMbId,
  children,
}: MusicBrainzLinkProps) {
  if (!releaseMbId) {
    return <>{children}</>;
  }

  return (
    <a
      href={`https://musicbrainz.org/release/${releaseMbId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-violet-400 transition-colors"
    >
      {children}
    </a>
  );
}
