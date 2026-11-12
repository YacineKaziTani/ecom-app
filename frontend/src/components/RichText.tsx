import { Fragment, ReactNode } from "react";
import { Link } from "react-router";
import { MISSING } from "../content/legal/types";

// Renders the small markup of the legal texts: [label](/path) links,
// **bold**, and the marker of a store detail that is still empty.
const TOKEN = /\[([^\]]+)\]\((\/[^)\s]*)\)|\*\*([^*]+)\*\*|⟪missing⟫/g;

export function RichText({ text, missingLabel }: { text: string; missingLabel: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    if (match[0] === MISSING) {
      parts.push(
        <mark key={index} className="rounded bg-warning-soft px-1 text-warning">
          {missingLabel}
        </mark>,
      );
    } else if (match[1] !== undefined) {
      parts.push(
        <Link key={index} to={match[2]} className="link-accent font-medium">
          {match[1]}
        </Link>,
      );
    } else {
      parts.push(
        <strong key={index} className="font-semibold text-foreground">
          {match[3]}
        </strong>,
      );
    }
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Fragment>{parts}</Fragment>;
}
