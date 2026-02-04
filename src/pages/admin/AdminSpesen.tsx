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
import { Download, Filter, Receipt, ExternalLink } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';

interface Profile {
  id: string;
  user_id: string;
  vorname: string;
  nachname: string;
}

interface Expense {
  id: string;
  user_id: string;
  datum: string;
  beschreibung: string | null;
  beleg_url: string | null;
  beleg_filename: string | null;
  profiles?: Profile;
}

export default function AdminSpesen() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<Expense[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [startDate, setStartDate] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [selectedUser, setSelectedUser] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    const { data: profilesData } = await supabase.from('profiles').select('*');
    setProfiles(profilesData || []);

    let query = supabase
      .from('expenses')
      .select('*')
      .gte('datum', startDate)
      .lte('datum', endDate)
      .order('datum', { ascending: false });

    if (selectedUser !== 'all') {
      query = query.eq('user_id', selectedUser);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching expenses:', error);
      setLoading(false);
      return;
    }

    const entriesWithProfiles = (data || []).map(entry => ({
      ...entry,
      profiles: (profilesData || []).find(p => p.user_id === entry.user_id),
    }));

    setEntries(entriesWithProfiles);
    setLoading(false);
  }, [startDate, endDate, selectedUser]);

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
      toast({ title: 'Keine Daten', description: 'Keine Einträge für diesen Zeitraum gefunden' });
      return;
    }

    const headers = ['Datum', 'Mitarbeiter', 'Beschreibung', 'Dateiname', 'Link'];
    const rows = entries.map((entry) => {
      const name = entry.profiles ? `${entry.profiles.vorname} ${entry.profiles.nachname}` : 'Unbekannt';
      return [
        format(new Date(entry.datum), 'dd.MM.yyyy'),
        name,
        entry.beschreibung || '',
        entry.beleg_filename || '',
        entry.beleg_url || '',
      ];
    });

    const csvContent = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Spesen_${startDate}_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: 'Export erfolgreich', description: 'CSV-Datei wurde heruntergeladen' });
  };

  return (
    <AdminLayout title="Spesen">
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
              <Button variant="outline" size="sm" onClick={setWeekPeriod}>Diese Woche</Button>
              <Button variant="outline" size="sm" onClick={setMonthPeriod}>Dieser Monat</Button>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Von</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bis</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mitarbeiter</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger><SelectValue placeholder="Alle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.vorname} {p.nachname}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <span className="font-medium">{entries.length} Belege</span>
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
                    <TableHead>Beschreibung</TableHead>
                    <TableHead>Beleg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Laden...</TableCell>
                    </TableRow>
                  ) : entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Keine Einträge gefunden</TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{format(new Date(entry.datum), 'dd.MM.yyyy', { locale: de })}</TableCell>
                        <TableCell>
                          {entry.profiles ? `${entry.profiles.vorname} ${entry.profiles.nachname}` : 'Unbekannt'}
                        </TableCell>
                        <TableCell>{entry.beschreibung || '–'}</TableCell>
                        <TableCell>
                          {entry.beleg_url ? (
                            <Button variant="ghost" size="sm" asChild className="gap-1 h-8">
                              <a href={entry.beleg_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                                Ansehen
                              </a>
                            </Button>
                          ) : (
                            '–'
                          )}
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
