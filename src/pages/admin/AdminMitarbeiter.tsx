import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';

interface Profile {
  id: string;
  user_id: string;
  vorname: string;
  nachname: string;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: string;
}

interface WorkerStats {
  profile: Profile;
  role: string;
  hoursThisMonth: number;
  entriesThisMonth: number;
}

export default function AdminMitarbeiter() {
  const [workers, setWorkers] = useState<WorkerStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

    const [
      { data: profiles },
      { data: roles },
      { data: timeEntries },
    ] = await Promise.all([
      supabase.from('profiles').select('*').order('nachname'),
      supabase.from('user_roles').select('*'),
      supabase.from('time_entries').select('user_id, total_stunden').gte('datum', monthStart).lte('datum', monthEnd),
    ]);

    const workerStats: WorkerStats[] = (profiles || []).map(profile => {
      const userRole = (roles || []).find(r => r.user_id === profile.user_id);
      const userEntries = (timeEntries || []).filter(e => e.user_id === profile.user_id);
      const totalHours = userEntries.reduce((sum, e) => sum + (e.total_stunden || 0), 0);

      return {
        profile,
        role: userRole?.role || 'worker',
        hoursThisMonth: totalHours,
        entriesThisMonth: userEntries.length,
      };
    });

    setWorkers(workerStats);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <AdminLayout title="Mitarbeiter">
      <div className="space-y-6">
        {/* Summary */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Registrierte Mitarbeiter</p>
                <p className="text-2xl font-semibold">{workers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alle Mitarbeiter</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Registriert</TableHead>
                    <TableHead className="text-right">Stunden (Monat)</TableHead>
                    <TableHead className="text-right">Einträge (Monat)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Laden...
                      </TableCell>
                    </TableRow>
                  ) : workers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Keine Mitarbeiter gefunden
                      </TableCell>
                    </TableRow>
                  ) : (
                    workers.map((worker) => (
                      <TableRow key={worker.profile.id}>
                        <TableCell className="font-medium">
                          {worker.profile.vorname} {worker.profile.nachname}
                        </TableCell>
                        <TableCell>
                          <Badge variant={worker.role === 'admin' ? 'default' : 'secondary'}>
                            {worker.role === 'admin' ? 'Admin' : 'Arbeiter'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(worker.profile.created_at), 'dd.MM.yyyy', { locale: de })}
                        </TableCell>
                        <TableCell className="text-right">
                          {worker.hoursThisMonth.toFixed(1)} h
                        </TableCell>
                        <TableCell className="text-right">
                          {worker.entriesThisMonth}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
