import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { PageClient } from "@/components/PageClient";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

/**
 * Per-wallet metadata. When someone shares a URL like /?wallet=0x..., Twitter's
 * crawler hits this page and reads og:image / twitter:image, which point at
 * /api/card-image?wallet=0x... — the same server-rendered PNG the user sees in
 * the app. Result: the tweet unfurls with the real card preview, no manual
 * paste required.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const wallet = isValidAddress(params.wallet) ? params.wallet : null;

  // Resolve the request origin so og:image is an absolute URL Twitter / Slack /
  // etc. can fetch. Works in any deployment without a baked-in env var.
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const baseTitle = "Trader Identity | Limitless";
  const baseDescription =
    "Discover your trader archetype on Limitless — the prediction market for everything.";

  if (!wallet) {
    return {
      title: baseTitle,
      description: baseDescription,
      openGraph: {
        title: baseTitle,
        description: baseDescription,
        siteName: "Limitless",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: baseTitle,
        description: baseDescription,
        site: "@trylimitless",
      },
    };
  }

  const imageUrl = `${origin}/api/card-image?wallet=${wallet}`;
  const shareTitle = "What kind of trader am I? — Limitless";
  const shareDescription =
    "I just got my Limitless trader archetype. Find yours.";

  return {
    title: shareTitle,
    description: shareDescription,
    openGraph: {
      title: shareTitle,
      description: shareDescription,
      siteName: "Limitless",
      type: "website",
      url: `${origin}/?wallet=${wallet}`,
      images: [
        {
          url: imageUrl,
          width: 1920,
          height: 1080,
          alt: "Limitless Trader Card",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: shareDescription,
      images: [imageUrl],
      site: "@trylimitless",
    },
  };
}

export default function Page() {
  // PageClient uses useSearchParams() to auto-load shared wallet links;
  // Suspense boundary is required for static prerender support.
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  );
}
