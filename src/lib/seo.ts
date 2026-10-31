// src/lib/seo.ts
export const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined) ?? "https://www.aura-academy.com"
).replace(/\/$/, "");

export const SITE_NAME = "AURA Academy";

export const DEFAULT_TITLE = "AURA Academy | Professional Barber Education & Seminars";

export const DEFAULT_DESCRIPTION =
  "Learn precision haircutting and clean fades at AURA Academy. Barber seminars led by founder Theopistos, professional education for barbers, and the AURA book.";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`; // 1200x630

interface SeoOptions {
  title?: string; // page title WITHOUT the brand, e.g. "Seminars"
  description?: string;
  path?: string; // e.g. "/seminars"
  image?: string;
  type?: "website" | "article" | "book";
  noindex?: boolean;
}

/** Use in any route: head: () => seo({ title: "Seminars", path: "/seminars", description: "..." }) */
export function seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image = DEFAULT_OG_IMAGE,
  type = "website",
  noindex = false,
}: SeoOptions = {}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const url = `${SITE_URL}${path === "/" ? "" : path}`;

  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: type },
      { property: "og:image", content: image },
      { name: "twitter:title", content: fullTitle },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      ...(noindex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
    ],
    links: [{ rel: "canonical", href: url }],
  };
}