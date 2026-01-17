import { useState } from "react";

interface AlbumArtProps {
  releaseMbId: string | null | undefined;
  alt: string;
}

export default function AlbumArt({ releaseMbId, alt }: AlbumArtProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!releaseMbId || hasError) {
    return (
      <div className="w-10 h-10 bg-zinc-800 flex items-center justify-center">
        <svg className="w-5 h-5 text-zinc-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
        </svg>
      </div>
    );
  }

  return (
    <>
      {isLoading && <div className="w-10 h-10 bg-zinc-800 animate-pulse" />}
      <img
        src={`https://coverartarchive.org/release/${releaseMbId}/front-250`}
        alt={alt}
        className={`w-10 h-10 object-cover ${isLoading ? 'hidden' : ''}`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </>
  );
}
