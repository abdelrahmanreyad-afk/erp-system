"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth, canAccessMasters, canAccessStockManager, canAccessPricelists, canAccessUsers, canAccessInventory } from "@/components/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  LayoutDashboard, MapPin, Tag, Grid2X2, Layers,
  Package, Boxes, BarChart3, ArrowLeftRight, Flame,
  Warehouse, ShoppingCart, TrendingUp, Calendar,
  ChevronDown, Store, Users, LogOut, DollarSign,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: any };
type Section = {
  label: string;
  icon: any;
  items: NavItem[];
  show: boolean;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role;

  const sections: Section[] = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      show: true,
      items: [
        { href: "/", label: "Overview", icon: LayoutDashboard },
      ],
    },
    {
      label: "POS",
      icon: Store,
      show: true,
      items: [
        { href: "/pos", label: "Point of Sale", icon: Store },
      ],
    },
    {
      label: "Masters",
      icon: Tag,
      show: !!role && canAccessMasters(role),
      items: [
        { href: "/masters/locations", label: "Locations", icon: MapPin },
        { href: "/masters/brands", label: "Brands", icon: Tag },
        { href: "/masters/categories", label: "Categories", icon: Grid2X2 },
        { href: "/masters/lines", label: "Lines", icon: Layers },
        { href: "/masters/products", label: "Products", icon: Package },
        { href: "/masters/variants", label: "Variants", icon: Boxes },
        { href: "/masters/payment-methods", label: "Payment Methods", icon: DollarSign },
        ...(role && canAccessPricelists(role) ? [{ href: "/masters/pricelists", label: "Pricelists", icon: DollarSign }] : []),
        
      ],
    },
    {
      label: "Inventory",
      icon: Warehouse,
      show: !!role && canAccessInventory(role),
      items: [
        { href: "/inventory/inventories", label: "Inventories", icon: Warehouse },
        ...(role && canAccessStockManager(role) ? [{ href: "/inventory/stock", label: "Stock Manager", icon: Boxes }] : []),
        { href: "/inventory/balance", label: "Stock Dashboard", icon: BarChart3 },
        { href: "/inventory/transfers", label: "Transfers", icon: ArrowLeftRight },
      ],
    },
    {
      label: "KPIs",
      icon: TrendingUp,
      show: true,
      items: [
        { href: "/kpis", label: "KPIs Overview", icon: TrendingUp },
      ],
    },
    {
      label: "Schedules",
      icon: Calendar,
      show: true,
      items: [
        { href: "/schedules", label: "Schedules", icon: Calendar },
      ],
    },
    {
      label: "Users",
      icon: Users,
      show: !!role && canAccessUsers(role),
      items: [
        { href: "/masters/users", label: "Users", icon: Users },
      ],
    },
  ];

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

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  const ROLE_COLORS: Record<string, string> = {
    admin: "text-purple-400",
    manager: "text-blue-400",
    agent: "text-green-400",
  };

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <span className="font-semibold text-sidebar-foreground">ERP System</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {sections.filter((s) => s.show).map((section) => {
          const isOpen = !!openSections[section.label];
          const SectionIcon = section.icon;
          const hasActiveChild = section.items.some((item) => isActive(item.href));

          return (
            <div key={section.label}>
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
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen && "rotate-180")} />
              </button>

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-accent-foreground shrink-0">
              {user?.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-sidebar-foreground truncate">{user?.name}</p>
              <p className={cn("text-xs capitalize", role ? ROLE_COLORS[role] : "text-muted-foreground")}>{role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted/50"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}