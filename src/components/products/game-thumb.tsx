// Picture of an official game (or its initial when it has none). The stored file is already a
// small WebP, so it is served as is, without going through the image optimizer.
import { publicUrl } from "@/lib/storage";

export function GameThumb({
  name,
  imageKey,
  size = 48,
}: {
  name: string;
  imageKey: string | null;
  size?: number;
}) {
  if (!imageKey)
    return (
      <span
        className="game-thumb placeholder"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        aria-hidden="true"
      >
        {name.charAt(0)}
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- already compressed on upload
    <img
      src={publicUrl(imageKey)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="game-thumb"
    />
  );
}
