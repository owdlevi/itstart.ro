import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { origin } from "@/server/origin";
import { fontVariables } from "./fonts";
import { Providers } from "./providers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const [t, base] = await Promise.all([getTranslations("metadata"), origin()]);
  const title = t("title");
  const description = t("description");
  // The site's defaults; a shared page replaces openGraph whole
  // (server/share-image/version.ts). The image is ./opengraph-image.tsx.
  return {
    metadataBase: new URL(base),
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "ITStart",
      locale: "ro_RO",
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const t = await getTranslations("shell");
  return (
    <html lang="ro" className={fontVariables} suppressHydrationWarning>
      <body className="bg-bg font-sans text-ink antialiased">
        <a href="#continut" className="skip-link">
          {t("skipLink")}
        </a>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
