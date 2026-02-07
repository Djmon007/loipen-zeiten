import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { ListTodo, Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Task {
  id: string;
  name: string;
  created_at: string;
}

export default function AdminAufgaben() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskName, setTaskName] = useState('');

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching tasks:', error);
      return;
    }

    setTasks(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const openNewDialog = () => {
    setEditingTask(null);
    setTaskName('');
    setDialogOpen(true);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setTaskName(task.name);
    setDialogOpen(true);
  };

  const saveTask = async () => {
    if (!taskName.trim()) {
      toast({
        title: 'Fehler',
        description: 'Bitte Name eingeben',
        variant: 'destructive',
      });
      return;
    }

    if (editingTask) {
      const { error } = await supabase
        .from('tasks')
        .update({ name: taskName.trim() })
        .eq('id', editingTask.id);

      if (error) {
        toast({
          title: 'Fehler',
          description: 'Aufgabe konnte nicht aktualisiert werden',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Aktualisiert', description: 'Aufgabe wurde geändert' });
    } else {
      const { error } = await supabase
        .from('tasks')
        .insert({ name: taskName.trim() });

      if (error) {
        toast({
          title: 'Fehler',
          description: 'Aufgabe konnte nicht erstellt werden',
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Erstellt', description: 'Neue Aufgabe hinzugefügt' });
    }

    setDialogOpen(false);
    setTaskName('');
    setEditingTask(null);
    fetchTasks();
  };

  const deleteTask = async (task: Task) => {
    if (!confirm(`Möchten Sie "${task.name}" wirklich löschen?`)) return;

    const { error } = await supabase.from('tasks').delete().eq('id', task.id);

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Aufgabe konnte nicht gelöscht werden',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Gelöscht', description: 'Aufgabe wurde entfernt' });
    fetchTasks();
  };

  return (
    <AdminLayout title="Aufgaben">
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              Aufgaben / Arbeitstypen
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openNewDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Neue Aufgabe
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTask ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      placeholder="z.B. Loipenpräparation"
                    />
                  </div>
                  <Button onClick={saveTask} className="w-full">
                    {editingTask ? 'Speichern' : 'Erstellen'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Laden...</p>
            ) : tasks.length === 0 ? (
              <p className="text-muted-foreground">Keine Aufgaben vorhanden</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-24">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.name}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(task)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTask(task)}
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
