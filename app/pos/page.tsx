"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Loader2, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Location = { id: string; name: string; type?: string };

export default function POSSelectorPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Location[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const snap = await getDocs(collection(db, "locations"));
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Location));
      const filtered = all
        .filter((l) => l.type === "branch" || l.type === "branch_warehouse")
        .sort((a, b) => a.name.localeCompare(b.name));
      setBranches(filtered);
      setLoading(false);
    }
    load();
  }, []);

  function handleEnter() {
    if (!selected) return;
    router.push(`/pos/${selected}`);
  }

  if (loading) return (
    <div className="flex justify-center items-center h-screen">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">

        {/* Icon + Title */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MapPin className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Select Branch</h1>
          <p className="text-sm text-muted-foreground">Choose a branch to start selling</p>
        </div>

        {/* Branch Cards */}
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {branches.map((branch) => (
            <button
              key={branch.id}
              onClick={() => setSelected(branch.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${
                selected === branch.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/40 text-foreground"
              }`}
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${selected === branch.id ? "bg-primary" : "bg-muted-foreground/30"}`} />
              {branch.name}
            </button>
          ))}
        </div>

        {/* CTA */}
        <Button
          className="w-full gap-2"
          disabled={!selected}
          onClick={handleEnter}
          size="lg"
        >
          Start Selling
          <ArrowRight className="h-4 w-4" />
        </Button>

      </div>
    </div>
  );
}