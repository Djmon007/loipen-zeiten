import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download, Filter, Clock } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';

interface Profile {
  id: string;
  user_id: string;
  vorname: string;
  nachname: string;
}

type WorkType = 'Loipenpräparation' | 'Aufbau' | 'Abbau' | 'Verschiedenes';

interface TimeEntry {
  id: string;
  user_id: string;
  datum: string;
  arbeit: WorkType;
  start_zeit: string | null;
  stopp_zeit: string | null;
  total_stunden: number | null;
  profiles?: Profile;
}

export default function AdminZeiterfassung() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [startDate, setStartDate] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    // Fetch profiles
    const { data: profilesData } = await supabase.from('profiles').select('*');
    setProfiles(profilesData || []);

    // Build query
    let query = supabase
      .from('time_entries')
      .select('*')
      .gte('datum', startDate)
      .lte('datum', endDate)
      .order('datum', { ascending: false })
      .order('start_zeit', { ascending: false });

    if (selectedUser !== 'all') {
      query = query.eq('user_id', selectedUser);
    }

    if (selectedProject !== 'all') {
      query = query.eq('arbeit', selectedProject as WorkType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching entries:', error);
      setLoading(false);
      return;
    }

    // Map profiles to entries
    const entriesWithProfiles = (data || []).map(entry => ({
      ...entry,
      arbeit: entry.arbeit as WorkType,
      profiles: (profilesData || []).find(p => p.user_id === entry.user_id),
    }));

    setEntries(entriesWithProfiles);
    setLoading(false);
  }, [startDate, endDate, selectedUser, selectedProject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setWeekPeriod = () => {
    setStartDate(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    setEndDate(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  };

  const setMonthPeriod = () => {
    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  };

  const exportCSV = () => {
    if (entries.length === 0) {
      toast({
        title: 'Keine Daten',
        description: 'Keine Einträge für diesen Zeitraum gefunden',
      });
      return;
    }

    const headers = ['Datum', 'Mitarbeiter', 'Projekt', 'Start', 'Stopp', 'Stunden'];
    const rows = entries.map((entry) => {
      const name = entry.profiles
        ? `${entry.profiles.vorname} ${entry.profiles.nachname}`
        : 'Unbekannt';
      return [
        format(new Date(entry.datum), 'dd.MM.yyyy'),
        name,
        entry.arbeit,
        entry.start_zeit?.substring(0, 5) || '',
        entry.stopp_zeit?.substring(0, 5) || '',
        entry.total_stunden?.toFixed(2) || '',
      ];
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map((row) => row.join(';')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Arbeitszeit_${startDate}_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export erfolgreich',
      description: 'CSV-Datei wurde heruntergeladen',
    });
  };

  const totalHours = entries.reduce((sum, e) => sum + (e.total_stunden || 0), 0);

  return (
    <AdminLayout title="Arbeitszeit">
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={setWeekPeriod}>
                Diese Woche
              </Button>
              <Button variant="outline" size="sm" onClick={setMonthPeriod}>
                Dieser Monat
              </Button>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Von</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bis</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mitarbeiter</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.vorname} {p.nachname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Projekt</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="Loipenpräparation">Loipenpräparation</SelectItem>
                    <SelectItem value="Aufbau">Aufbau</SelectItem>
                    <SelectItem value="Abbau">Abbau</SelectItem>
                    <SelectItem value="Verschiedenes">Verschiedenes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium">{entries.length} Einträge</span>
            </div>
            <span className="text-muted-foreground">|</span>
            <span className="font-semibold text-primary">{totalHours.toFixed(1)} Stunden</span>
          </div>
          <Button onClick={exportCSV} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            CSV Export
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Mitarbeiter</TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Stopp</TableHead>
                    <TableHead className="text-right">Stunden</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Laden...
                      </TableCell>
                    </TableRow>
                  ) : entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Keine Einträge gefunden
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {format(new Date(entry.datum), 'dd.MM.yyyy', { locale: de })}
                        </TableCell>
                        <TableCell>
                          {entry.profiles
                            ? `${entry.profiles.vorname} ${entry.profiles.nachname}`
                            : 'Unbekannt'}
                        </TableCell>
                        <TableCell>{entry.arbeit}</TableCell>
                        <TableCell>{entry.start_zeit?.substring(0, 5) || '–'}</TableCell>
                        <TableCell>{entry.stopp_zeit?.substring(0, 5) || '–'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {entry.total_stunden?.toFixed(1) || '–'}
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
