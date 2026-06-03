import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/components/AuthContext";
import { AppShell } from "@/components/AppShell";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)}>
      <body className={cn(geist.className, "bg-background text-foreground")}>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}