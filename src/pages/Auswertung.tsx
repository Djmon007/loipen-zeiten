import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Download, Users, Clock, Fuel, MapPin } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

interface Profile {
  id: string;
  user_id: string;
  vorname: string;
  nachname: string;
}

interface TimeEntrySummary {
  user_id: string;
  total_hours: number;
  profile?: Profile;
}

interface DieselSummary {
  tank: string;
  total_liter: number;
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
}

interface DieselEntry {
  id: string;
  user_id: string;
  datum: string;
  tank: string;
  liter: number;
}

export default function Auswertung() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [timeSummary, setTimeSummary] = useState<TimeEntrySummary[]>([]);
  const [dieselSummary, setDieselSummary] = useState<DieselSummary[]>([]);
  const [period, setPeriod] = useState<'week' | 'month'>('week');

  // Date range
  const [startDate, setStartDate] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch all profiles
    const { data: profilesData } = await supabase.from('profiles').select('*');
    setProfiles(profilesData || []);

    // Fetch time entries for period
    const { data: timeData } = await supabase
      .from('time_entries')
      .select('*')
      .gte('datum', startDate)
      .lte('datum', endDate);

    // Aggregate by user
    const userHours: Record<string, number> = {};
    (timeData || []).forEach((entry) => {
      const userId = entry.user_id;
      userHours[userId] = (userHours[userId] || 0) + (entry.total_stunden || 0);
    });

    const summary: TimeEntrySummary[] = Object.entries(userHours).map(([userId, hours]) => ({
      user_id: userId,
      total_hours: hours,
      profile: (profilesData || []).find((p) => p.user_id === userId),
    }));

    summary.sort((a, b) => b.total_hours - a.total_hours);
    setTimeSummary(summary);

    // Fetch diesel entries for period
    const { data: dieselData } = await supabase
      .from('diesel_entries')
      .select('*')
      .gte('datum', startDate)
      .lte('datum', endDate);

    // Aggregate by tank
    const tankLiters: Record<string, number> = {};
    (dieselData || []).forEach((entry) => {
      tankLiters[entry.tank] = (tankLiters[entry.tank] || 0) + Number(entry.liter);
    });

    const dieselSum: DieselSummary[] = Object.entries(tankLiters).map(([tank, liter]) => ({
      tank,
      total_liter: liter,
    }));

    setDieselSummary(dieselSum);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setWeekPeriod = () => {
    setPeriod('week');
    setStartDate(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    setEndDate(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  };

  const setMonthPeriod = () => {
    setPeriod('month');
    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  };

  const exportCSV = async () => {
    // Fetch detailed data for export
    const { data: timeData } = await supabase
      .from('time_entries')
      .select('*')
      .gte('datum', startDate)
      .lte('datum', endDate)
      .order('datum', { ascending: true });

    if (!timeData || timeData.length === 0) {
      toast({
        title: 'Keine Daten',
        description: 'Keine Einträge für diesen Zeitraum gefunden',
      });
      return;
    }

    // Create CSV content
    const headers = ['Datum', 'Mitarbeiter', 'Projekt', 'Start', 'Stopp', 'Stunden'];
    const rows = (timeData as TimeEntry[]).map((entry) => {
      const profile = profiles.find((p) => p.user_id === entry.user_id);
      const name = profile ? `${profile.vorname} ${profile.nachname}` : 'Unbekannt';
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

    // Download file
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

  const totalHours = timeSummary.reduce((sum, s) => sum + s.total_hours, 0);
  const totalDiesel = dieselSummary.reduce((sum, s) => sum + s.total_liter, 0);

  return (
    <AppLayout title="Auswertung">
      <div className="space-y-6">
        {/* Period Selection */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-2 mb-4">
              <Button
                variant={period === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={setWeekPeriod}
              >
                Diese Woche
              </Button>
              <Button
                variant={period === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={setMonthPeriod}
              >
                Dieser Monat
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Von</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-alpine"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Bis</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input-alpine"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="stats-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Arbeitsstunden</p>
                  <p className="text-xl font-semibold">{totalHours.toFixed(1)} h</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="stats-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Fuel className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Diesel</p>
                  <p className="text-xl font-semibold">{totalDiesel.toFixed(0)} L</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tables */}
        <Tabs defaultValue="zeit" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="zeit">Arbeitszeit</TabsTrigger>
            <TabsTrigger value="diesel">Diesel</TabsTrigger>
          </TabsList>

          <TabsContent value="zeit" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Stunden pro Mitarbeiter
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground text-sm">Laden...</p>
                ) : timeSummary.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Keine Einträge für diesen Zeitraum</p>
                ) : (
                  <div className="space-y-3">
                    {timeSummary.map((item) => (
                      <div
                        key={item.user_id}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {item.profile
                              ? `${item.profile.vorname} ${item.profile.nachname}`
                              : 'Unbekannt'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{item.total_hours.toFixed(1)} h</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diesel" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Fuel className="h-4 w-4 text-primary" />
                  Liter pro Tank
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground text-sm">Laden...</p>
                ) : dieselSummary.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Keine Einträge für diesen Zeitraum</p>
                ) : (
                  <div className="space-y-3">
                    {dieselSummary.map((item) => (
                      <div
                        key={item.tank}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                      >
                        <div>
                          <p className="font-medium text-sm">{item.tank}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{item.total_liter.toFixed(0)} L</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Export Button */}
        <Button onClick={exportCSV} className="w-full gap-2" variant="outline">
          <Download className="h-4 w-4" />
          CSV exportieren
        </Button>
      </div>
    </AppLayout>
  );
}
