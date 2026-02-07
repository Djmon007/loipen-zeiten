import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LoipeConfig {
  id: string;
  name: string;
  has_skating: boolean;
  has_klassisch: boolean;
  has_skipiste: boolean;
  sort_order: number;
}

export default function AdminLoipenConfig() {
  const { toast } = useToast();
  const [loipen, setLoipen] = useState<LoipeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLoipe, setEditingLoipe] = useState<LoipeConfig | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [hasSkating, setHasSkating] = useState(true);
  const [hasKlassisch, setHasKlassisch] = useState(true);
  const [hasSkipiste, setHasSkipiste] = useState(false);

  const fetchLoipen = useCallback(async () => {
    const { data, error } = await supabase
      .from('loipen_config')
      .select('*')
      .order('sort_order');

    if (error) {
      console.error('Error fetching loipen config:', error);
      return;
    }

    setLoipen(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLoipen();
  }, [fetchLoipen]);

  const openNewDialog = () => {
    setEditingLoipe(null);
    setName('');
    setHasSkating(true);
    setHasKlassisch(true);
    setHasSkipiste(false);
    setDialogOpen(true);
  };

  const openEditDialog = (loipe: LoipeConfig) => {
    setEditingLoipe(loipe);
    setName(loipe.name);
    setHasSkating(loipe.has_skating);
    setHasKlassisch(loipe.has_klassisch);
    setHasSkipiste(loipe.has_skipiste);
    setDialogOpen(true);
  };

  const saveLoipe = async () => {
    if (!name.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte Name eingeben',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      name: name.trim(),
      has_skating: hasSkating,
      has_klassisch: hasKlassisch,
      has_skipiste: hasSkipiste,
    };

    if (editingLoipe) {
      const { error } = await supabase
        .from('loipen_config')
        .update(payload)
        .eq('id', editingLoipe.id);

      if (error) {
        toast({
          title: 'Fehler',
          description: 'Loipe konnte nicht aktualisiert werden',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Aktualisiert', description: 'Loipe wurde geändert' });
    } else {
      const maxOrder = loipen.length > 0 ? Math.max(...loipen.map(l => l.sort_order)) : 0;
      const { error } = await supabase
        .from('loipen_config')
        .insert({ ...payload, sort_order: maxOrder + 1 });

      if (error) {
        toast({
          title: 'Fehler',
          description: 'Loipe konnte nicht erstellt werden',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Erstellt', description: 'Neue Loipe hinzugefügt' });
    }

    setDialogOpen(false);
    resetForm();
    fetchLoipen();
  };

  const resetForm = () => {
    setName('');
    setHasSkating(true);
    setHasKlassisch(true);
    setHasSkipiste(false);
    setEditingLoipe(null);
  };

  const deleteLoipe = async (loipe: LoipeConfig) => {
    if (!confirm(`Möchten Sie "${loipe.name}" wirklich löschen?`)) return;

    const { error } = await supabase.from('loipen_config').delete().eq('id', loipe.id);

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Loipe konnte nicht gelöscht werden',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Gelöscht', description: 'Loipe wurde entfernt' });
    fetchLoipen();
  };

  return (
    <AdminLayout title="Loipen-Konfiguration">
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Loipen / Strecken
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openNewDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Neue Loipe
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingLoipe ? 'Loipe bearbeiten' : 'Neue Loipe'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="z.B. Schwanden - Nidfurn"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Optionen</Label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="skating"
                          checked={hasSkating}
                          onCheckedChange={(c) => setHasSkating(!!c)}
                        />
                        <Label htmlFor="skating" className="cursor-pointer">
                          Skating
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="klassisch"
                          checked={hasKlassisch}
                          onCheckedChange={(c) => setHasKlassisch(!!c)}
                        />
                        <Label htmlFor="klassisch" className="cursor-pointer">
                          Klassisch
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="skipiste"
                          checked={hasSkipiste}
                          onCheckedChange={(c) => setHasSkipiste(!!c)}
                        />
                        <Label htmlFor="skipiste" className="cursor-pointer">
                          Skipiste (nur ein Checkbox)
                        </Label>
                      </div>
                    </div>
                  </div>

                  <Button onClick={saveLoipe} className="w-full">
                    {editingLoipe ? 'Speichern' : 'Erstellen'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Laden...</p>
            ) : loipen.length === 0 ? (
              <p className="text-muted-foreground">Keine Loipen konfiguriert</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Skating</TableHead>
                    <TableHead>Klassisch</TableHead>
                    <TableHead>Skipiste</TableHead>
                    <TableHead className="w-24">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loipen.map((loipe) => (
                    <TableRow key={loipe.id}>
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-medium">{loipe.name}</TableCell>
                      <TableCell>{loipe.has_skating ? '✓' : '-'}</TableCell>
                      <TableCell>{loipe.has_klassisch ? '✓' : '-'}</TableCell>
                      <TableCell>{loipe.has_skipiste ? '✓' : '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(loipe)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteLoipe(loipe)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
