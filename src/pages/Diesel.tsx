import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Fuel, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

type DieselTank = 'Tank Nidfurn' | 'Tank Hätzingen';

const TANKS: DieselTank[] = ['Tank Nidfurn', 'Tank Hätzingen'];

interface DieselEntry {
  id: string;
  datum: string;
  tank: DieselTank;
  liter: number;
}

export default function Diesel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<DieselEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedTank, setSelectedTank] = useState<DieselTank>('Tank Nidfurn');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [liter, setLiter] = useState('');

  const fetchEntries = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('diesel_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('datum', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching diesel entries:', error);
      return;
    }

    const typedData = (data || []).map(entry => ({
      ...entry,
      tank: entry.tank as DieselTank
    }));

    setEntries(typedData);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const addEntry = async () => {
    if (!user || !liter) return;

    const literValue = parseFloat(liter);
    if (isNaN(literValue) || literValue <= 0) {
      toast({
        title: 'Fehler',
        description: 'Bitte gültige Literzahl eingeben',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('diesel_entries').insert({
      user_id: user.id,
      datum: selectedDate,
      tank: selectedTank,
      liter: literValue,
    });

    setSaving(false);

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Eintrag konnte nicht gespeichert werden',
        variant: 'destructive',
      });
      return;
    }

    setLiter('');
    fetchEntries();
    toast({
      title: 'Gespeichert',
      description: `${literValue} Liter bei ${selectedTank} erfasst`,
    });
  };

  return (
    <AppLayout title="Diesel-Tankung">
      <div className="space-y-6">
        {/* Add Entry Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Fuel className="h-4 w-4 text-primary" />
              Neue Tankung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tank</Label>
              <Select
                value={selectedTank}
                onValueChange={(v) => setSelectedTank(v as DieselTank)}
              >
                <SelectTrigger className="input-alpine">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TANKS.map((tank) => (
                    <SelectItem key={tank} value={tank}>
                      {tank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Datum</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-alpine"
              />
            </div>

            <div className="space-y-2">
              <Label>Liter</Label>
              <Input
                type="number"
                placeholder="z.B. 100"
                value={liter}
                onChange={(e) => setLiter(e.target.value)}
                className="input-alpine"
                min="0"
                step="0.1"
              />
            </div>

            <Button onClick={addEntry} disabled={saving || !liter} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              {saving ? 'Speichern...' : 'Eintrag hinzufügen'}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Entries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Letzte Tankungen</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Laden...</p>
            ) : entries.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine Einträge vorhanden</p>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{entry.tank}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.datum), 'dd.MM.yyyy', { locale: de })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{entry.liter} L</p>
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
