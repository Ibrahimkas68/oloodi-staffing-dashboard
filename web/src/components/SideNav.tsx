import { Brand } from './Brand.js';

type View = 'dashboard' | 'worker';

const LINKS: Array<{ view: View; href: string; label: string }> = [
  { view: 'dashboard', href: '/', label: 'Dashboard' },
  { view: 'worker', href: '/worker', label: 'Worker view' },
];

/**
 * Left navigation of the desktop shell (Dashboard.dc.html). Hidden below `lg`, where each page
 * puts a link to the other view in its own header instead.
 */
export function SideNav({ current }: { current: View }) {
  return (
    <nav className="hidden w-[180px] shrink-0 flex-col gap-8 px-3.5 py-7 lg:flex" aria-label="Views">
      <div className="px-2.5">
        <Brand />
      </div>
      <div className="flex flex-col gap-1 text-[15px]">
        {LINKS.map(({ view, href, label }) =>
          view === current ? (
            <a key={view} href={href} aria-current="page" className="flex h-10 items-center rounded-sm bg-shell-hover px-3 font-medium">
              {label}
            </a>
          ) : (
            <a key={view} href={href} className="flex h-10 items-center rounded-sm px-3 text-shell-mid hover:text-shell-text">
              {label}
            </a>
          ),
        )}
      </div>
    </nav>
  );
}
