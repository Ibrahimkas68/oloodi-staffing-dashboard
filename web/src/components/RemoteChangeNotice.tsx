/**
 * Violet pill above the shift card (State Sheet, "Invited + notice"). The live region is always in
 * the page and only its content comes and goes, because screen readers skip a region that is
 * inserted already filled in.
 */
export function RemoteChangeNotice({ visible }: { visible: boolean }) {
  return (
    <div role="status" className="contents">
      {visible && (
        <div className="flex items-center gap-2.5 rounded-[14px] bg-p-invited px-3.5 py-[11px] text-[15px] font-medium text-violet-ink animate-fade md:self-start md:pr-5">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-pill bg-violet" />
          Updated from another session
        </div>
      )}
    </div>
  );
}
