export function Brand({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const box = size === 'lg' ? 'size-5 rounded-[7px]' : 'size-[18px] rounded-[5px]';
  const inner = size === 'lg' ? 'size-2' : 'size-[7px]';
  return (
    <span className={`flex items-center gap-2.5 font-semibold tracking-tight ${size === 'lg' ? 'text-lg' : 'text-[17px] gap-2'}`}>
      <span className={`inline-flex items-center justify-center bg-shell-text ${box}`} aria-hidden="true">
        <span className={`rounded-[2px] bg-shell ${inner}`} />
      </span>
      Shiftboard
    </span>
  );
}
