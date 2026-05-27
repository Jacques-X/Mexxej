"use client";

interface Props {
  mediaUrl: string;
  locationName: string;
}

export default function MediaMoodBoard({ mediaUrl, locationName }: Props) {
  const isVideo = /\.(mp4|webm|mov)$/i.test(mediaUrl);
  return (
    <div style={{ border: "1px solid var(--mxj-stroke)", overflow: "hidden", aspectRatio: "16/9" }}>
      {isVideo ? (
        <video
          src={mediaUrl}
          controls
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <img
          src={mediaUrl}
          alt={locationName}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
    </div>
  );
}
