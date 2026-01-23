import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ClubScout",
  description: "Sam’s Club liquidation lookup tool"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Tailwind CDN to avoid config files (perfect for GitHub editor-only workflow) */}
        <script src="https://cdn.tailwindcss.com"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              tailwind.config = {
                theme: {
                  extend: {
                    colors: {
                      sams: {
                        50: "#eef6ff",
                        100: "#d9ebff",
                        200: "#b3d7ff",
                        300: "#80bdff",
                        400: "#4da3ff",
                        500: "#1a89ff",
                        600: "#006fe6",
                        700: "#0056b3",
                        800: "#003d80",
                        900: "#00264d"
                      }
                    },
                    boxShadow: {
                      soft: "0 10px 30px rgba(0,0,0,0.10)"
                    }
                  }
                }
              }
            `
          }}
        />
        <style>{`
          html, body { height: 100%; }
          body { background: #020617; color: #e2e8f0; }
          * { -webkit-tap-highlight-color: transparent; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
