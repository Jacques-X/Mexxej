"use client";

// Renders the correct embed based on the media_url:
//   • TikTok  → oembed script embed
//   • Instagram → blockquote embed
//   • PDF/image from Supabase Storage → iframe / img
//   • YouTube → iframe

import { useEffect, useRef } from "react";
import { FileText, ExternalLink } from "lucide-react";

interface Props {
  mediaUrl: string;
  locationName: string;
}

type MediaType = "tiktok" | "instagram" | "youtube" | "pdf" | "image" | "unknown";

function detectType(url: string): MediaType {
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/\.pdf(\?|$)/i.test(url)) return "pdf";
  if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)) return "image";
  return "unknown";
}

function youtubeEmbedUrl(url: string): string {
  const match = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  const id = match?.[1] ?? "";
  return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0`;
}

export default function MediaMoodBoard({ mediaUrl, locationName }: Props) {
  const type = detectType(mediaUrl);
  const tiktokRef = useRef<HTMLDivElement>(null);

  // TikTok requires their JS script to process the blockquote
  useEffect(() => {
    if (type !== "tiktok" || !tiktokRef.current) return;
    const script = document.createElement("script");
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    tiktokRef.current.appendChild(script);
  }, [type]);

  // Instagram: load embed.js once; call process() if already loaded
  useEffect(() => {
    if (type !== "instagram") return;
    const w = window as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (w.instgrm?.Embeds) {
      w.instgrm.Embeds.process();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.onload = () => w.instgrm?.Embeds?.process();
    document.body.appendChild(script);
    return () => { script.remove(); };
  }, [type]);

  if (type === "tiktok") {
    const videoId = mediaUrl.split("/video/")[1]?.split("?")[0] ?? "";
    return (
      <div ref={tiktokRef} className="rounded-xl overflow-hidden bg-black/30">
        <blockquote
          className="tiktok-embed"
          cite={mediaUrl}
          data-video-id={videoId}
          style={{ maxWidth: "100%", minWidth: "auto" }}
        >
          <section />
        </blockquote>
      </div>
    );
  }

  if (type === "instagram") {
    return (
      <div className="rounded-xl overflow-hidden bg-black/30">
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={mediaUrl}
          data-instgrm-version="14"
          style={{ maxWidth: "100%", minWidth: "auto" }}
        />
      </div>
    );
  }

  if (type === "youtube") {
    return (
      <div className="rounded-xl overflow-hidden aspect-video bg-black/30">
        <iframe
          src={youtubeEmbedUrl(mediaUrl)}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={`${locationName} video`}
        />
      </div>
    );
  }

  if (type === "pdf") {
    return (
      <div className="rounded-xl overflow-hidden bg-black/30 flex flex-col items-center gap-2 py-4 px-3">
        <FileText className="w-8 h-8 text-zinc-400" />
        <p className="text-xs text-zinc-400 text-center font-medium">{locationName} — Menu / PDF</p>
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open PDF
        </a>
        <iframe
          src={mediaUrl}
          className="w-full h-40 rounded-lg mt-1"
          title={`${locationName} PDF`}
        />
      </div>
    );
  }

  if (type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={mediaUrl}
        alt={locationName}
        className="w-full rounded-xl object-cover max-h-48 bg-black/30"
        loading="lazy"
      />
    );
  }

  // Fallback: plain link
  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-xs text-sky-400 hover:text-sky-300 transition-colors
                 bg-white/5 rounded-lg px-3 py-2 border border-white/8"
    >
      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{mediaUrl}</span>
    </a>
  );
}
