import React from "react";

function classes(...values) {
  return values.filter(Boolean).join(" ");
}

export function Badge({children, variant = "outline", className, ...props}) {
  return <span className={classes("ui-badge", `ui-badge--${variant}`, className)} {...props}>{children}</span>;
}

export function Button({children, variant = "outline", size = "sm", className, ...props}) {
  return <span className={classes("ui-button", `ui-button--${variant}`, `ui-button--${size}`, className)} {...props}>{children}</span>;
}

export function Card({children, className, ...props}) {
  return <div className={classes("ui-card", className)} {...props}>{children}</div>;
}

export function CardContent({children, className, ...props}) {
  return <div className={classes("ui-card__content", className)} {...props}>{children}</div>;
}

export function Progress({value, label}) {
  const normalized = Math.max(0, Math.min(100, Number(value) || 0));
  return <div className="ui-progress" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(normalized)}>
    <span className="ui-progress__indicator" style={{transform:`translateX(-${100 - normalized}%)`}} />
  </div>;
}

export function Table({children, className, ...props}) {
  return <div className="ui-table-container"><table className={classes("ui-table", className)} {...props}>{children}</table></div>;
}

export const TableHeader = ({children}) => <thead className="ui-table__header">{children}</thead>;
export const TableBody = ({children}) => <tbody className="ui-table__body">{children}</tbody>;
export const TableRow = ({children}) => <tr className="ui-table__row">{children}</tr>;
export const TableHead = ({children}) => <th className="ui-table__head">{children}</th>;
export const TableCell = ({children}) => <td className="ui-table__cell">{children}</td>;
