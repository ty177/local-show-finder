import type { EventData } from "./types";

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatIcsDate(date: string, time: string): string {
  // date: "2026-04-20", time: "19:00:00"
  const d = date.replace(/-/g, "");
  if (time) {
    const t = time.replace(/:/g, "").substring(0, 6);
    return `${d}T${t}`;
  }
  return d;
}

function foldLine(line: string): string {
  // ICS spec: lines should not exceed 75 octets. Fold by inserting CRLF + space.
  const maxLen = 75;
  if (line.length <= maxLen) return line;
  let result = line.substring(0, maxLen);
  let remaining = line.substring(maxLen);
  while (remaining.length > 0) {
    const chunk = remaining.substring(0, maxLen - 1);
    result += "\r\n " + chunk;
    remaining = remaining.substring(maxLen - 1);
  }
  return result;
}

export function generateIcsFeed(events: EventData[], zipCode: string): string {
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LocalShowFinder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Local Shows Near " + zipCode,
    "X-WR-CALDESC:Upcoming concerts from your Spotify playlists",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const event of events) {
    const dtStart = formatIcsDate(event.date, event.time);
    // Assume ~3 hour duration for concerts
    const endDate = new Date(event.date + (event.time ? `T${event.time}` : ""));
    endDate.setHours(endDate.getHours() + 3);
    const dtEnd = formatIcsDate(
      endDate.toISOString().split("T")[0],
      endDate.toISOString().split("T")[1]?.substring(0, 8) || ""
    );

    const artistNames = event.matchedArtists.map((a) => a.name).join(", ");
    const gaNote = event.generalAdmission ? " [GA Only]" : "";
    const priceNote = event.priceRange ? ` | ${event.priceRange}` : "";

    const description = [
      `Artists from your playlists: ${artistNames}`,
      `Venue: ${event.venue}`,
      event.priceRange ? `Price: ${event.priceRange}` : null,
      event.generalAdmission ? "General Admission Only" : null,
      "",
      `Buy Tickets: ${event.ticketUrl}`,
    ]
      .filter((l) => l !== null)
      .join("\\n");

    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${event.id}@localshowfinder`));
    lines.push(foldLine(`DTSTAMP:${now}`));
    lines.push(foldLine(`DTSTART:${dtStart}`));
    lines.push(foldLine(`DTEND:${dtEnd}`));
    lines.push(
      foldLine(`SUMMARY:${escapeIcsText(event.name)}${gaNote}${priceNote}`)
    );
    lines.push(foldLine(`DESCRIPTION:${description}`));
    lines.push(foldLine(`LOCATION:${escapeIcsText(event.venueAddress || event.venue)}`));
    lines.push(foldLine(`URL:${event.ticketUrl}`));
    if (event.generalAdmission) {
      lines.push("CATEGORIES:General Admission");
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
