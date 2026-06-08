"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, query, where } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Shield, Users, Hash } from "lucide-react";
import { useAuth } from "@/components/AuthContext";

type Role = "admin" | "manager" | "agent";
type AppUser = { id: string; name: string; email: string; role: Role; code?: string };

const ROLE_COLORS: Record<Role, string> = {
  admin: "bg-purple-500/10 text-purple-400",
  manager: "bg-blue-500/10 text-blue-400",
  agent: "bg-green-500/10 text-green-400",
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", password: "", role: "agent" as Role, code: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [editItem, setEditItem] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "agent" as Role, code: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [deleteItem, setDeleteItem] = useState<AppUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadUsers() {
    setLoading(true);
    const snap = await getDocs(collection(db, "users"));
    setUsers(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as AppUser))
        .sort((a, b) => (a.code || "").localeCompare(b.code || ""))
    );
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  // ── Check code uniqueness ──
  async function isCodeTaken(code: string, excludeId?: string): Promise<boolean> {
    if (!code.trim()) return false;
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.some((d) => {
      if (excludeId && d.id === excludeId) return false;
      return (d.data().code || "").toLowerCase() === code.trim().toLowerCase();
    });
  }

  // ── Add User ──
  async function handleAdd() {
    setAddError("");
    if (!addForm.name || !addForm.email || !addForm.password) {
      setAddError("Name, email and password are required."); return;
    }
    if (addForm.password.length < 6) {
      setAddError("Password must be at least 6 characters."); return;
    }
    if (!addForm.code.trim()) {
      setAddError("User code is required."); return;
    }
    setAddLoading(true);
    try {
      const codeTaken = await isCodeTaken(addForm.code);
      if (codeTaken) { setAddError("This code is already in use."); setAddLoading(false); return; }

      const cred = await createUserWithEmailAndPassword(auth, addForm.email, addForm.password);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: addForm.name,
        email: addForm.email,
        role: addForm.role,
        code: addForm.code.trim().toUpperCase(),
        createdAt: new Date(),
      });
      setAddOpen(false);
      setAddForm({ name: "", email: "", password: "", role: "agent", code: "" });
      await loadUsers();
    } catch (e: any) {
      switch (e.code) {
        case "auth/email-already-in-use": setAddError("Email already in use."); break;
        case "auth/invalid-email": setAddError("Invalid email."); break;
        default: setAddError("Failed to create user: " + e.message);
      }
    } finally { setAddLoading(false); }
  }

  // ── Edit User ──
  function openEdit(u: AppUser) {
    setEditItem(u);
    setEditForm({ name: u.name, role: u.role, code: u.code || "" });
    setEditError("");
  }

  async function handleEdit() {
    if (!editItem) return;
    setEditError("");
    if (!editForm.code.trim()) { setEditError("User code is required."); return; }
    setEditLoading(true);
    try {
      const codeTaken = await isCodeTaken(editForm.code, editItem.id);
      if (codeTaken) { setEditError("This code is already in use."); setEditLoading(false); return; }

      await updateDoc(doc(db, "users", editItem.id), {
        name: editForm.name,
        role: editForm.role,
        code: editForm.code.trim().toUpperCase(),
      });
      setEditItem(null);
      await loadUsers();
    } finally { setEditLoading(false); }
  }

  // ── Delete User ──
  async function handleDelete() {
    if (!deleteItem) return;
    if (deleteItem.id === currentUser?.uid) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, "users", deleteItem.id));
      setDeleteItem(null);
      await loadUsers();
    } finally { setDeleteLoading(false); }
  }

  const adminCount = users.filter((u) => u.role === "admin").length;
  const managerCount = users.filter((u) => u.role === "manager").length;
  const agentCount = users.filter((u) => u.role === "agent").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage system users and roles</p>
        </div>
        <Button onClick={() => { setAddError(""); setAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{users.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Admins</CardTitle>
            <Shield className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-purple-400">{adminCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Managers / Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold">{managerCount + agentCount}</div></CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No users found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-3 px-4">Code</th>
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Email</th>
                  <th className="text-left py-3 px-4">Role</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                        {u.code || "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {u.name}
                      {u.id === currentUser?.uid && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${ROLE_COLORS[u.role]}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="icon-sm" onClick={() => openEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {u.id !== currentUser?.uid && (
                          <Button variant="destructive" size="icon-sm" onClick={() => setDeleteItem(u)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">User Code <span className="text-destructive">*</span></label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  placeholder="e.g. USR-001"
                  value={addForm.code}
                  onChange={(e) => setAddForm({ ...addForm, code: e.target.value })}
                  style={{ paddingLeft: "2rem" }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Unique code used to identify this user across the system.</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Full Name <span className="text-destructive">*</span></label>
              <input placeholder="e.g. John Doe" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Email <span className="text-destructive">*</span></label>
              <input type="email" placeholder="john@example.com" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Password <span className="text-destructive">*</span></label>
              <input type="password" placeholder="Min. 6 characters" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Role</label>
              <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value as Role })}>
                <option value="agent">Agent</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {addError && <p className="text-destructive text-sm">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addLoading}>
              {addLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">User Code <span className="text-destructive">*</span></label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  placeholder="e.g. USR-001"
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                  style={{ paddingLeft: "2rem" }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Full Name</label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Role</label>
              <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}>
                <option value="agent">Agent</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">Email cannot be changed. Password reset is done through Firebase Console.</p>
            {editError && <p className="text-destructive text-sm">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editLoading}>
              {editLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete User</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete{" "}
            <span className="text-foreground font-medium">{deleteItem?.name}</span>
            {deleteItem?.code && (
              <span className="ml-1 font-mono text-xs text-muted-foreground">({deleteItem.code})</span>
            )}
            ? This only removes them from the system, not from Firebase Auth.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}