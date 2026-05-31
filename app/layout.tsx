import "./globals.css";
import { Geist } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)}>
      <body className={cn(geist.className, "bg-background text-foreground")}>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-5">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}