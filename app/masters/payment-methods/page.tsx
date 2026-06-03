"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

type PaymentMethod = { id: string; name: string };

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [editItem, setEditItem] = useState<PaymentMethod | null>(null);
  const [editName, setEditName] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteItem, setDeleteItem] = useState<PaymentMethod | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function load() {
    setLoading(true);
    const snap = await getDocs(collection(db, "payment_methods"));
    setMethods(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentMethod)));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!addName.trim()) return;
    setAddLoading(true);
    await addDoc(collection(db, "payment_methods"), { name: addName.trim(), createdAt: new Date() });
    setAddOpen(false); setAddName(""); await load();
    setAddLoading(false);
  }

  async function handleEdit() {
    if (!editItem || !editName.trim()) return;
    setEditLoading(true);
    await updateDoc(doc(db, "payment_methods", editItem.id), { name: editName.trim() });
    setEditItem(null); await load();
    setEditLoading(false);
  }

  async function handleDelete() {
    if (!deleteItem) return;
    setDeleteLoading(true);
    await deleteDoc(doc(db, "payment_methods", deleteItem.id));
    setDeleteItem(null); await load();
    setDeleteLoading(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payment Methods</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage available payment methods</p>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Method</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm text-muted-foreground">Total: {methods.length}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          : methods.length === 0 ? <p className="text-center text-muted-foreground py-10">No payment methods yet.</p>
          : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground"><th className="text-left py-3 px-4">Name</th><th className="text-right py-3 px-4">Actions</th></tr></thead>
              <tbody>
                {methods.map((m) => (
                  <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium">{m.name}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="icon-sm" onClick={() => { setEditItem(m); setEditName(m.name); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="destructive" size="icon-sm" onClick={() => setDeleteItem(m)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add Payment Method</DialogTitle></DialogHeader>
          <div className="py-2 space-y-1"><label className="text-sm text-muted-foreground">Name</label>
            <input placeholder="e.g. Cash, Visa, Bank Transfer" value={addName} onChange={(e) => setAddName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addLoading}>{addLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent><DialogHeader><DialogTitle>Edit Payment Method</DialogTitle></DialogHeader>
          <div className="py-2 space-y-1"><label className="text-sm text-muted-foreground">Name</label>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editLoading}>{editLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <DialogContent><DialogHeader><DialogTitle>Delete Payment Method</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Are you sure you want to delete <span className="text-foreground font-medium">{deleteItem?.name}</span>?</p>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>{deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}