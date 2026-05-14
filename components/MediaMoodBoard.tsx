"use client";

// Renders the correct embed based on the media_url:
//   • TikTok  → oembed script embed
//   • Instagram → blockquote embed
//   • PDF/image from Supabase Storage → iframe / img
//   • YouTube → iframe

import { useEffect, useRef } from "react";
import { FileText, ExternalLink, AlertCircle } from "lucide-react";

interface Props {
  mediaUrl: string;
  locationName: string;
}

type MediaType = "tiktok" | "instagram" | "youtube" | "pdf" | "image" | "unknown";

// Only allow embedding content from these known-safe hosts
const ALLOWED_HOSTS = [
  "www.youtube.com", "youtube.com", "youtu.be",
  "www.tiktok.com", "tiktok.com",
  "www.instagram.com", "instagram.com",
];

function isSafeUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:") return false;
    if (ALLOWED_HOSTS.includes(hostname)) return true;
    // Supabase storage URLs are safe (project.supabase.co)
    if (hostname.endsWith(".supabase.co")) return true;
    return false;
  } catch {
    return false;
  }
}

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
  const safe = isSafeUrl(mediaUrl);
  const type = safe ? detectType(mediaUrl) : "unknown";
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
    if (!videoId) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(224,112,112,0.1)", border: "1px solid rgba(224,112,112,0.3)" }}>
          <AlertCircle style={{ width: 14, height: 14, color: "#e07070", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "#e07070" }}>Invalid TikTok URL — paste a link like tiktok.com/@user/video/123</span>
        </div>
      );
    }
    return (
      <div ref={tiktokRef} style={{ borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,0.3)" }}>
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
      <div style={{ borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,0.3)" }}>
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
      <div style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "16/9", background: "rgba(0,0,0,0.3)" }}>
        <iframe
          src={youtubeEmbedUrl(mediaUrl)}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={`${locationName} video`}
        />
      </div>
    );
  }

  if (type === "pdf") {
    return (
      <div style={{ borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 12px" }}>
        <FileText style={{ width: 32, height: 32, color: "var(--mxj-faint)" }} />
        <p style={{ fontSize: 11, color: "var(--mxj-muted)", textAlign: "center", fontWeight: 500, margin: 0 }}>{locationName} — Menu / PDF</p>
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#7ec8f0", textDecoration: "none", transition: "color 0.15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#6db8e0")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#7ec8f0")}
        >
          <ExternalLink style={{ width: 14, height: 14, flexShrink: 0 }} />
          Open PDF
        </a>
        <iframe
          src={mediaUrl}
          style={{ width: "100%", height: 160, borderRadius: 8, marginTop: 8, border: "none" }}
          title={`${locationName} PDF`}
          sandbox="allow-same-origin"
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
        style={{ width: "100%", borderRadius: 12, objectFit: "cover", maxHeight: 192, background: "rgba(0,0,0,0.3)" }}
        loading="lazy"
      />
    );
  }

  // Blocked URL: show a warning instead of rendering an unsafe embed/link
  if (!safe) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(224,112,112,0.1)", border: "1px solid rgba(224,112,112,0.3)" }}>
        <AlertCircle style={{ width: 14, height: 14, color: "#e07070", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "#e07070" }}>Unsupported URL — use YouTube, TikTok, Instagram, or a Supabase storage link</span>
      </div>
    );
  }

  // Fallback: plain link for supabase URLs that didn't match a media type
  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        color: "#7ec8f0",
        textDecoration: "none",
        background: "rgba(255,255,255,0.05)",
        borderRadius: 8,
        padding: "8px 12px",
        border: "1px solid rgba(255,255,255,0.08)",
        transition: "color 0.15s"
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#6db8e0")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#7ec8f0")}
    >
      <ExternalLink style={{ width: 14, height: 14, flexShrink: 0 }} />
      <span style={{ textOverflow: "ellipsis", overflow: "hidden", maxWidth: "100%", whiteSpace: "nowrap" }}>{mediaUrl}</span>
    </a>
  );
}
