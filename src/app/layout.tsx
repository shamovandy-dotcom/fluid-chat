import type { Metadata, Viewport } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "АНДРОЛИТ — корпоративный мессенджер",
  description: "АНДРОЛИТ — корпоративный мессенджер для команды: каналы, личные сообщения и файлы.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f1114" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1114" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
