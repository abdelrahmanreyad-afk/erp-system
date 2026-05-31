import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Boxes, Package, Warehouse } from "lucide-react";

const stats = [
  { title: "Total Stock", value: "0", icon: Boxes, desc: "Total units across all locations" },
  { title: "Products", value: "0", icon: Package, desc: "Active products in catalog" },
  { title: "Warehouses", value: "0", icon: Warehouse, desc: "Locations & branches" },
];

export default function Home() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your inventory</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}