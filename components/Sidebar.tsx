"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, MapPin, Tag, Grid2X2, Layers,
  Package, Boxes, BarChart3, ArrowLeftRight, Flame,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
];

const masters = [
  { href: "/masters/locations", label: "Locations", icon: MapPin },
  { href: "/masters/brands", label: "Brands", icon: Tag },
  { href: "/masters/categories", label: "Categories", icon: Grid2X2 },
  { href: "/masters/lines", label: "Lines", icon: Layers },
  { href: "/masters/products", label: "Products", icon: Package },
  { href: "/masters/variants", label: "Variants", icon: Boxes },
];

const inventory = [
  { href: "/inventory/stock", label: "Stock Manager", icon: Boxes },
  { href: "/inventory/balance", label: "Dashboard", icon: BarChart3 },
  { href: "/inventory/transfers", label: "Transfers", icon: ArrowLeftRight },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <span className="font-semibold text-sidebar-foreground">ERP System</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        <SectionLabel label="Masters" />
        {masters.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        <SectionLabel label="Inventory" />
        {inventory.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}
      </nav>
    </aside>
  );
}

function NavItem({ href, label, icon: Icon, active }: {
  href: string; label: string; icon: any; active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider px-3 pt-4 pb-1">
      {label}
    </p>
  );
}