"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, MapPin, Tag, Grid2X2, Layers,
  Package, Boxes, BarChart3, ArrowLeftRight, Flame,
  Warehouse, ShoppingCart, TrendingUp, Calendar,
  ChevronDown, Store,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: any };
type Section = { label: string; icon: any; items: NavItem[] };

const sections: Section[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "POS",
    icon: Store,
    items: [
      { href: "/pos", label: "Point of Sale", icon: Store },
    ],
  },
  {
    label: "Masters",
    icon: Tag,
    items: [
      { href: "/masters/locations", label: "Locations", icon: MapPin },
      { href: "/masters/brands", label: "Brands", icon: Tag },
      { href: "/masters/categories", label: "Categories", icon: Grid2X2 },
      { href: "/masters/lines", label: "Lines", icon: Layers },
      { href: "/masters/products", label: "Products", icon: Package },
      { href: "/masters/variants", label: "Variants", icon: Boxes },
      { href: "/masters/pricelists", label: "Pricelists", icon: Tag },
    ],
  },
  {
    label: "Inventory",
    icon: Warehouse,
    items: [
      { href: "/inventory/inventories", label: "Inventories", icon: Warehouse },
      { href: "/inventory/stock", label: "Stock Manager", icon: Boxes },
      { href: "/inventory/balance", label: "Stock Dashboard", icon: BarChart3 },
      { href: "/inventory/transfers", label: "Transfers", icon: ArrowLeftRight },
    ],
  },
  {
    label: "KPIs",
    icon: TrendingUp,
    items: [
      { href: "/kpis", label: "KPIs Overview", icon: TrendingUp },
    ],
  },
  {
    label: "Schedules",
    icon: Calendar,
    items: [
      { href: "/schedules", label: "Schedules", icon: Calendar },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  // figure out which section is active by default
  function getDefaultOpen() {
    const open: Record<string, boolean> = {};
    sections.forEach((s) => {
      if (s.items.some((item) => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href)))) {
        open[s.label] = true;
      }
    });
    return open;
  }

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(getDefaultOpen);

  function toggleSection(label: string) {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <span className="font-semibold text-sidebar-foreground">DIRECT SALES MASTER</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {sections.map((section) => {
          const isOpen = !!openSections[section.label];
          const SectionIcon = section.icon;
          const hasActiveChild = section.items.some((item) => isActive(item.href));

          return (
            <div key={section.label}>
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.label)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                  hasActiveChild
                    ? "text-sidebar-foreground font-medium"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <SectionIcon className="h-4 w-4 shrink-0" />
                  {section.label}
                </div>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    isOpen ? "rotate-180" : ""
                  )}
                />
              </button>

              {/* Section Items */}
              {isOpen && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-accent-foreground">
            N
          </div>
          <span className="text-sm text-sidebar-foreground/60">Admin</span>
        </div>
      </div>
    </aside>
  );
}