import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const pretendard = localFont({
  variable: "--font-pretendard",
  display: "swap",
  src: [
    { path: "../public/fonts/Pretendard-Thin.woff2", weight: "100", style: "normal" },
    { path: "../public/fonts/Pretendard-ExtraLight.woff2", weight: "200", style: "normal" },
    { path: "../public/fonts/Pretendard-Light.woff2", weight: "300", style: "normal" },
    { path: "../public/fonts/Pretendard-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/Pretendard-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/Pretendard-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/Pretendard-Bold.woff2", weight: "700", style: "normal" },
    { path: "../public/fonts/Pretendard-ExtraBold.woff2", weight: "800", style: "normal" },
    { path: "../public/fonts/Pretendard-Black.woff2", weight: "900", style: "normal" },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** 공개 URL(OG `metadataBase` 기본). 커스텀 도메인이면 `NEXT_PUBLIC_APP_URL`로 덮어쓴다. */
const PRODUCTION_APP_URL = "https://moyora-scheduler.vercel.app";

function getMetadataBase(): URL {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return new URL(process.env.NEXT_PUBLIC_APP_URL);
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.NODE_ENV === "development") {
    return new URL("http://localhost:3000");
  }
  return new URL(PRODUCTION_APP_URL);
}

const ogTitle = "모여라 - 일정 조율";
const ogDescription =
  "닉네임으로 쉽게 참여하고, 가능한 날짜를 한눈에 확인할 수 있어요.";

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: ogTitle,
  description: "친구들과 약속/여행 일정을 빠르게 조율하는 서비스",
  openGraph: {
    title: ogTitle,
    description: ogDescription,
    type: "website",
    locale: "ko_KR",
    siteName: "모여라",
    images: [
      {
        url: "/images/og.jpg",
        width: 1200,
        height: 630,
        alt: "모여라 — 약속과 여행 일정을 빠르게 맞춰보세요",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: ogTitle,
    description: ogDescription,
    images: ["/images/og.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${pretendard.className} min-h-full bg-app-bg text-app-text`}>
        {children}
      </body>
    </html>
  );
}
