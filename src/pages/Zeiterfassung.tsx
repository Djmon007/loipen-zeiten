import { useState, useEffect, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Play, Square, Plus, Clock, Calendar, Pause, PlayCircle } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { de } from 'date-fns/locale';

type WorkType = 'Loipenpräparation' | 'Aufbau' | 'Abbau' | 'Verschiedenes';

const WORK_TYPES: WorkType[] = ['Loipenpräparation', 'Aufbau', 'Abbau', 'Verschiedenes'];

interface TimeEntry {
  id: string;
  datum: string;
  arbeit: WorkType;
  start_zeit: string | null;
  stopp_zeit: string | null;
  total_stunden: number | null;
}

export default function Zeiterfassung() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedProject, setSelectedProject] = useState<WorkType>('Loipenpräparation');
  const [weeklyHours, setWeeklyHours] = useState(0);
  const [monthlyHours, setMonthlyHours] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const pausedTimeRef = useRef(0);
  const pauseStartRef = useRef<Date | null>(null);

  // Manual entry dialog state
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualDate, setManualDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [manualProject, setManualProject] = useState<WorkType>('Loipenpräparation');
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');

  const fetchEntries = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('datum', { ascending: false })
      .order('start_zeit', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching entries:', error);
      return;
    }

    const typedData = (data || []).map(entry => ({
      ...entry,
      arbeit: entry.arbeit as WorkType
    }));

    setEntries(typedData);

    // Find active timer (entry with start but no stop)
    const active = typedData.find(
      (e) => e.start_zeit && !e.stopp_zeit && e.datum === format(new Date(), 'yyyy-MM-dd')
    );
    setActiveTimer(active || null);

    // Calculate weekly and monthly hours
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const { data: weekData } = await supabase
      .from('time_entries')
      .select('total_stunden')
      .eq('user_id', user.id)
      .gte('datum', format(weekStart, 'yyyy-MM-dd'))
      .lte('datum', format(weekEnd, 'yyyy-MM-dd'));

    const { data: monthData } = await supabase
      .from('time_entries')
      .select('total_stunden')
      .eq('user_id', user.id)
      .gte('datum', format(monthStart, 'yyyy-MM-dd'))
      .lte('datum', format(monthEnd, 'yyyy-MM-dd'));

    const weekTotal = (weekData || []).reduce((sum, e) => sum + (e.total_stunden || 0), 0);
    const monthTotal = (monthData || []).reduce((sum, e) => sum + (e.total_stunden || 0), 0);

    setWeeklyHours(weekTotal);
    setMonthlyHours(monthTotal);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Timer effect
  useEffect(() => {
    if (!activeTimer || !activeTimer.start_zeit || isPaused) return;

    const startTime = new Date(`${activeTimer.datum}T${activeTimer.start_zeit}`);
    
    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000) - pausedTimeRef.current;
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer, isPaused]);

  const startTimer = async () => {
    if (!user) return;

    const now = new Date();
    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        user_id: user.id,
        datum: format(now, 'yyyy-MM-dd'),
        arbeit: selectedProject,
        start_zeit: format(now, 'HH:mm:ss'),
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Timer konnte nicht gestartet werden',
        variant: 'destructive',
      });
      return;
    }

    setActiveTimer({
      ...data,
      arbeit: data.arbeit as WorkType
    });
    setElapsedTime(0);
    pausedTimeRef.current = 0;
    setIsPaused(false);
    toast({
      title: 'Timer gestartet',
      description: `${selectedProject} läuft`,
    });
  };

  const pauseTimer = () => {
    if (!isPaused) {
      pauseStartRef.current = new Date();
      setIsPaused(true);
      toast({
        title: 'Pause',
        description: 'Timer pausiert',
      });
    }
  };

  const resumeTimer = () => {
    if (isPaused && pauseStartRef.current) {
      const pauseDuration = Math.floor((new Date().getTime() - pauseStartRef.current.getTime()) / 1000);
      pausedTimeRef.current += pauseDuration;
      pauseStartRef.current = null;
      setIsPaused(false);
      toast({
        title: 'Weiter',
        description: 'Timer läuft wieder',
      });
    }
  };

  const stopTimer = async () => {
    if (!activeTimer || !user) return;

    const now = new Date();
    const startTime = new Date(`${activeTimer.datum}T${activeTimer.start_zeit}`);
    
    // Subtract paused time from total
    let totalSeconds = (now.getTime() - startTime.getTime()) / 1000;
    if (isPaused && pauseStartRef.current) {
      totalSeconds -= (now.getTime() - pauseStartRef.current.getTime()) / 1000;
    }
    totalSeconds -= pausedTimeRef.current;
    
    const totalHours = totalSeconds / 3600;

    const { error } = await supabase
      .from('time_entries')
      .update({
        stopp_zeit: format(now, 'HH:mm:ss'),
        total_stunden: Math.round(totalHours * 100) / 100,
      })
      .eq('id', activeTimer.id);

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Timer konnte nicht gestoppt werden',
        variant: 'destructive',
      });
      return;
    }

    setActiveTimer(null);
    setElapsedTime(0);
    pausedTimeRef.current = 0;
    setIsPaused(false);
    fetchEntries();
    toast({
      title: 'Timer gestoppt',
      description: `${formatDuration(elapsedTime)} erfasst`,
    });
  };

  const addManualEntry = async () => {
    if (!user || !manualStart || !manualEnd) return;

    const start = new Date(`${manualDate}T${manualStart}`);
    const end = new Date(`${manualDate}T${manualEnd}`);
    const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    if (totalHours <= 0) {
      toast({
        title: 'Fehler',
        description: 'Endzeit muss nach Startzeit sein',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase.from('time_entries').insert({
      user_id: user.id,
      datum: manualDate,
      arbeit: manualProject,
      start_zeit: manualStart + ':00',
      stopp_zeit: manualEnd + ':00',
      total_stunden: Math.round(totalHours * 100) / 100,
    });

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Eintrag konnte nicht gespeichert werden',
        variant: 'destructive',
      });
      return;
    }

    setManualDialogOpen(false);
    setManualStart('');
    setManualEnd('');
    fetchEntries();
    toast({
      title: 'Eintrag gespeichert',
      description: `${Math.round(totalHours * 100) / 100} Stunden erfasst`,
    });
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (time: string | null): string => {
    if (!time) return '-';
    return time.substring(0, 5);
  };

  return (
    <AppLayout title="Zeiterfassung">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="stats-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Diese Woche</p>
                  <p className="text-xl font-semibold">{weeklyHours.toFixed(1)} h</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="stats-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dieser Monat</p>
                  <p className="text-xl font-semibold">{monthlyHours.toFixed(1)} h</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timer Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Timer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeTimer && (
              <Select
                value={selectedProject}
                onValueChange={(v) => setSelectedProject(v as WorkType)}
              >
                <SelectTrigger className="input-alpine">
                  <SelectValue placeholder="Projekt wählen" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {activeTimer && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-1">{activeTimer.arbeit}</p>
                <p className={`text-4xl font-mono font-bold ${isPaused ? 'text-warning' : 'text-primary timer-pulse'}`}>
                  {formatDuration(elapsedTime)}
                </p>
                {isPaused && (
                  <p className="text-sm text-warning mt-2">⏸ Pausiert</p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              {!activeTimer ? (
                <Button onClick={startTimer} className="flex-1 gap-2">
                  <Play className="h-4 w-4" />
                  Starten
                </Button>
              ) : (
                <>
                  <Button onClick={stopTimer} variant="destructive" className="flex-1 gap-2">
                    <Square className="h-4 w-4" />
                    Stoppen
                  </Button>
                  {!isPaused ? (
                    <Button onClick={pauseTimer} variant="outline" className="gap-2">
                      <Pause className="h-4 w-4" />
                      Pause
                    </Button>
                  ) : (
                    <Button onClick={resumeTimer} variant="secondary" className="gap-2">
                      <PlayCircle className="h-4 w-4" />
                      Weiter
                    </Button>
                  )}
                </>
              )}

              <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Manuell
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Manueller Eintrag</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Datum</Label>
                      <Input
                        type="date"
                        value={manualDate}
                        onChange={(e) => setManualDate(e.target.value)}
                        className="input-alpine"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Projekt</Label>
                      <Select
                        value={manualProject}
                        onValueChange={(v) => setManualProject(v as WorkType)}
                      >
                        <SelectTrigger className="input-alpine">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WORK_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start</Label>
                        <Input
                          type="time"
                          value={manualStart}
                          onChange={(e) => setManualStart(e.target.value)}
                          className="input-alpine"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Stopp</Label>
                        <Input
                          type="time"
                          value={manualEnd}
                          onChange={(e) => setManualEnd(e.target.value)}
                          className="input-alpine"
                        />
                      </div>
                    </div>
                    <Button onClick={addManualEntry} className="w-full">
                      Speichern
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Recent Entries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Letzte Einträge</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Laden...</p>
            ) : entries.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine Einträge vorhanden</p>
            ) : (
              <div className="space-y-3">
                {entries.slice(0, 5).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{entry.arbeit}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.datum), 'dd.MM.yyyy', { locale: de })}
                        {' • '}
                        {formatTime(entry.start_zeit)} - {formatTime(entry.stopp_zeit)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">
                        {entry.total_stunden ? `${entry.total_stunden.toFixed(1)} h` : '-'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
