import type { Assignment, Snapshot } from '@staffing/shared';
import { firstName, formatDay, formatTime, initials } from '../lib/format.js';
import { avatarFor } from '../lib/workerAvatars.js';
import { attendanceLabel, participationLabel } from './StatusBadges.js';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2';

function Initials({ name, className }: { name: string; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-pill font-semibold ${className}`}
    >
      {initials(name)}
    </span>
  );
}

/** The square portrait of a tile: the cut-out on its gradient, or big initials without a photo. */
function Portrait({ name }: { name: string }) {
  const { src, gradient } = avatarFor(name);
  return (
    <span className="relative block aspect-square overflow-hidden rounded-panel" style={{ backgroundImage: gradient }}>
      {src ? (
        <>
          <img src={src} alt="" decoding="async" draggable={false} className="absolute inset-0 size-full object-cover object-top" />
          <Initials
            name={name}
            className="absolute top-2.5 left-2.5 h-[26px] min-w-[26px] bg-shell/[0.28] px-2 text-xs text-white"
          />
        </>
      ) : (
        <Initials name={name} className="absolute inset-0 text-5xl text-white/90" />
      )}
    </span>
  );
}

function PickerTile({ assignment, onPick }: { assignment: Assignment; onPick: (workerId: number) => void }) {
  const { worker, participation, attendance } = assignment;
  const status = `${participationLabel(participation)} · ${attendanceLabel(attendance)}`;
  return (
    <li>
      <button
        type="button"
        // Spelled out so the name and both statuses are read as one phrase.
        aria-label={`${worker.fullName}, ${participationLabel(participation)}, ${attendanceLabel(attendance)}`}
        onClick={() => onPick(worker.id)}
        className={`group flex w-full cursor-pointer flex-col gap-2.5 rounded-panel text-left outline-ink ${FOCUS_RING}`}
      >
        <Portrait name={worker.fullName} />
        <span className="flex min-h-[52px] items-center justify-center rounded-pill bg-ink px-3 text-base font-semibold text-shell-text transition-[filter,transform] duration-150 group-hover:brightness-95 group-active:scale-[0.97]">
          {firstName(worker.fullName)}
        </span>
        <span className="-mt-1 text-center text-[13px] leading-[1.3] text-mid">{status}</span>
      </button>
    </li>
  );
}

/**
 * Start screen: pick your name from the roster (there is no login). Never selects anyone on its
 * own, so a shared phone cannot act as the wrong person. On phones the title sits on the dark
 * header block; from `md` up the page header is already dark, so it moves onto the light panel.
 */
export function WorkerPicker({ snapshot, onPick }: { snapshot: Snapshot; onPick: (workerId: number) => void }) {
  const { shift } = snapshot;
  return (
    <>
      <div className="flex flex-col gap-2 bg-shell px-4 pt-3 pb-7 text-shell-text md:bg-transparent md:p-0 md:text-ink">
        <h1 tabIndex={-1} className="m-0 text-[32px] leading-[1.1] font-semibold tracking-tight outline-none">
          Who&rsquo;s working today?
        </h1>
        <p className="m-0 text-[15px] leading-[1.45] text-shell-mid md:text-mid">
          {shift.title}
          <br />
          {formatDay(shift.startsAt)} · {formatTime(shift.startsAt)}–{formatTime(shift.endsAt)} · {shift.location}
        </p>
      </div>
      <div className="flex flex-col gap-2.5 px-4 pt-5 md:px-0 md:pt-8">
        <h2 className="m-0 px-1 text-sm font-medium text-mid">Tap your name</h2>
        <ul className="m-0 grid list-none grid-cols-2 gap-x-3.5 gap-y-4 p-0 md:grid-cols-[repeat(auto-fill,minmax(200px,240px))] md:gap-6">
          {snapshot.assignments.map((assignment) => (
            <PickerTile key={assignment.id} assignment={assignment} onPick={onPick} />
          ))}
        </ul>
      </div>
    </>
  );
}

/** Header pill that says whose view this is, with a way back to the picker. */
export function ViewingAs({ assignment, onSwitch }: { assignment: Assignment; onSwitch: () => void }) {
  const name = assignment.worker.fullName;
  return (
    <div className="flex items-center gap-3 rounded-pill border border-shell-line bg-shell-raised py-1.5 pr-1.5 pl-2 md:min-w-[220px] lg:min-w-[300px]">
      <Initials name={name} className="size-[34px] bg-shell-text text-[13px] text-ink" />
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-xs text-shell-mid">Viewing as</span>
        <span className="truncate text-base font-semibold">{name}</span>
      </div>
      <button
        type="button"
        onClick={onSwitch}
        aria-label="Switch worker"
        className={`h-11 shrink-0 cursor-pointer rounded-pill border border-shell-edge bg-transparent px-[18px] text-sm font-medium text-shell-text outline-shell-text hover:bg-shell-raised-hover ${FOCUS_RING}`}
      >
        Switch
      </button>
    </div>
  );
}
