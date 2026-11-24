import {useEffect, useId, useMemo, useRef, useState, type KeyboardEvent} from "react";
import type {Campaign} from "./contracts";
import {localDay} from "./dates";
import {Icon} from "./Icons";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthStart(day: string): Date {
  const date = new Date(`${day}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return monthStart(localDay(new Date()));
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

/** A keyboard-operable month grid, shared by the composer and schedule view. */
export function Calendar({selectedDay, onSelect, campaigns = [], disallowPast = false, compact = false, disabled = false}: {
  selectedDay: string;
  onSelect(day: string): void;
  campaigns?: readonly Campaign[];
  disallowPast?: boolean;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [month, setMonth] = useState(() => monthStart(selectedDay));
  const gridRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const today = localDay(new Date());
  useEffect(() => {setMonth(monthStart(selectedDay));}, [selectedDay]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    campaigns.filter(campaign => campaign.status !== "cancelled").forEach(campaign => {
      const day = localDay(new Date(campaign.sendAt));
      map.set(day, (map.get(day) ?? 0) + 1);
    });
    return map;
  }, [campaigns]);
  const days = useMemo(() => {
    const start = new Date(month);
    start.setDate(1 - (month.getDay() + 6) % 7);
    return Array.from({length: 42}, (_, index) => {
      const value = new Date(start);
      value.setDate(start.getDate() + index);
      return value;
    });
  }, [month]);
  const select = (day: string, focus = false) => {
    if (disabled || disallowPast && day < today) return;
    onSelect(day);
    const date = monthStart(day);
    if (date.getTime() !== month.getTime()) setMonth(date);
    if (focus) requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus());
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    let step: number;
    switch (event.key) {
      case "ArrowLeft": step = -1; break;
      case "ArrowRight": step = 1; break;
      case "ArrowUp": step = -7; break;
      case "ArrowDown": step = 7; break;
      case "Home": step = -(date.getDay() + 6) % 7; break;
      case "End": step = 6 - (date.getDay() + 6) % 7; break;
      default: return;
    }
    event.preventDefault();
    const next = new Date(date);
    next.setDate(next.getDate() + step);
    select(localDay(next), true);
  };
  const moveMonth = (amount: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1, 12);
    setMonth(next);
  };
  const monthLabel = new Intl.DateTimeFormat(undefined, {month: "long", year: "numeric"}).format(month);
  const selectedVisible = days.some(date => localDay(date) === selectedDay && (!disallowPast || selectedDay >= today));
  const firstSelectable = days.find(date => date.getMonth() === month.getMonth() && (!disallowPast || localDay(date) >= today));
  return <div className={`calendar ${compact ? "calendar-compact" : ""}`}>
    <div className="calendar-toolbar">
      <h3 id={headingId}>{monthLabel}</h3>
      <div className="calendar-navigation">
        <button type="button" className="icon-button" aria-label="Previous month" disabled={disabled || disallowPast && month <= monthStart(today)} onClick={() => moveMonth(-1)}><Icon name="left" size={17} /></button>
        <button type="button" className="today-button" disabled={disabled} onClick={() => select(today)}>Today</button>
        <button type="button" className="icon-button" aria-label="Next month" disabled={disabled} onClick={() => moveMonth(1)}><Icon name="right" size={17} /></button>
      </div>
    </div>
    <div ref={gridRef} role="grid" aria-labelledby={headingId}>
      <div className="calendar-week" role="row">{weekDays.map(day => <span key={day} role="columnheader">{day}</span>)}</div>
      {Array.from({length: 6}, (_, week) => <div className="calendar-week" role="row" key={week}>
        {days.slice(week * 7, week * 7 + 7).map(date => {
          const day = localDay(date);
          const count = counts.get(day) ?? 0;
          const outside = date.getMonth() !== month.getMonth();
          const past = disallowPast && day < today;
          const selected = selectedDay === day;
          return <button type="button" key={day} role="gridcell" data-day={day}
            className={`calendar-day ${outside ? "outside" : ""} ${selected ? "selected" : ""} ${day === today ? "is-today" : ""}`}
            aria-label={`${new Intl.DateTimeFormat(undefined, {dateStyle: "full"}).format(date)}${count ? `, ${count} notification${count === 1 ? "" : "s"}` : ""}`}
            aria-selected={selected} aria-current={day === today ? "date" : undefined} disabled={past || disabled}
            tabIndex={selected || !selectedVisible && firstSelectable && day === localDay(firstSelectable) ? 0 : -1}
            onClick={() => select(day)} onKeyDown={event => onKeyDown(event, date)}>
            <span>{date.getDate()}</span>{count > 0 && <i aria-hidden="true">{compact ? "" : count}</i>}
          </button>;
        })}
      </div>)}
    </div>
  </div>;
}
