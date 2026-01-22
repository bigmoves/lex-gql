import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  headerChart?: React.ReactNode;
}

export default function Layout({ children, headerChart }: LayoutProps) {
  const location = useLocation();
  const isTracksPage = location.pathname.startsWith('/tracks');
  const isAlbumsPage = location.pathname.startsWith('/albums');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-mono">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-4 border-b border-zinc-800 pb-4 relative">
          {headerChart && (
            <div className="absolute inset-0 pointer-events-none opacity-40">{headerChart}</div>
          )}
          <div className="flex items-end justify-between relative">
            <div>
              <h1 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Listening History
              </h1>
              <p className="text-xs text-zinc-600 mt-1">fm.teal.alpha.feed.play</p>
            </div>

            <div className="flex gap-4 text-xs">
              <Link
                to="/"
                className={`px-2 py-1 transition-colors ${
                  location.pathname === '/' ? 'text-zinc-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Recent
              </Link>
              <Link
                to="/tracks"
                className={`px-2 py-1 transition-colors ${
                  isTracksPage ? 'text-zinc-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Top Tracks
              </Link>
              <Link
                to="/albums"
                className={`px-2 py-1 transition-colors ${
                  isAlbumsPage ? 'text-zinc-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Top Albums
              </Link>
            </div>
          </div>
        </div>

        {isTracksPage && (
          <div className="flex gap-3 text-xs mb-8 pb-4 border-b border-zinc-800">
            <Link
              to="/tracks"
              className={`px-2 py-1 transition-colors ${
                location.pathname === '/tracks'
                  ? 'text-zinc-300'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              All Time
            </Link>
            <Link
              to="/tracks/daily"
              className={`px-2 py-1 transition-colors ${
                location.pathname === '/tracks/daily'
                  ? 'text-zinc-300'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              Daily
            </Link>
            <Link
              to="/tracks/weekly"
              className={`px-2 py-1 transition-colors ${
                location.pathname === '/tracks/weekly'
                  ? 'text-zinc-300'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              Weekly
            </Link>
            <Link
              to="/tracks/monthly"
              className={`px-2 py-1 transition-colors ${
                location.pathname === '/tracks/monthly'
                  ? 'text-zinc-300'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              Monthly
            </Link>
          </div>
        )}

        {isAlbumsPage && (
          <div className="flex gap-3 text-xs mb-8 pb-4 border-b border-zinc-800">
            <Link
              to="/albums"
              className={`px-2 py-1 transition-colors ${
                location.pathname === '/albums'
                  ? 'text-zinc-300'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              All Time
            </Link>
            <Link
              to="/albums/daily"
              className={`px-2 py-1 transition-colors ${
                location.pathname === '/albums/daily'
                  ? 'text-zinc-300'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              Daily
            </Link>
            <Link
              to="/albums/weekly"
              className={`px-2 py-1 transition-colors ${
                location.pathname === '/albums/weekly'
                  ? 'text-zinc-300'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              Weekly
            </Link>
            <Link
              to="/albums/monthly"
              className={`px-2 py-1 transition-colors ${
                location.pathname === '/albums/monthly'
                  ? 'text-zinc-300'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              Monthly
            </Link>
          </div>
        )}

        {!isTracksPage && !isAlbumsPage && <div className="mb-8"></div>}

        {children}
      </div>
    </div>
  );
}
