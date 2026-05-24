import type { PhotoCredit } from "../graph/types.ts";

interface PortraitProps {
  name?: string;
  photo?: PhotoCredit | null;
  vacancy?: boolean;
}

function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31 + name.charCodeAt(i)) >>> 0);
  return h % 360;
}

export function paletteFor(name: string): Record<string, string> {
  const hue = hueFor(name);
  return {
    "--c1": `oklch(0.88 0.035 ${hue})`,
    "--c2": `oklch(0.70 0.05 ${(hue + 30) % 360})`,
  } as Record<string, string>;
}

export function initialsOf(name: string): string {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
}

export function Portrait({ name, photo, vacancy }: PortraitProps) {
  if (vacancy) {
    return (
      <div className="portrait" aria-hidden="true">
        <span className="vlabel">Vacant</span>
      </div>
    );
  }
  if (photo) {
    const raw = photo.src;
    const src = raw.startsWith("/")
      ? import.meta.env.BASE_URL + raw.slice(1)
      : raw;
    return (
      <div className="portrait portrait--photo" aria-hidden="true">
        <img src={src} alt={name} className="portrait-img" />
      </div>
    );
  }
  return (
    <div
      className="portrait"
      style={paletteFor(name!)}
      aria-hidden="true"
    >
      <span className="glyph">{initialsOf(name!)}</span>
    </div>
  );
}
