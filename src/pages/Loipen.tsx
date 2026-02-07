import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Save, Check } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface LoipeConfig {
  key: string;
  name: string;
  skatingKey: string;
  klassischKey: string;
  hasSkipiste?: boolean;
}

const LOIPEN: LoipeConfig[] = [
  {
    key: 'schwanden_nidfurn',
    name: 'Schwanden - Nidfurn',
    skatingKey: 'schwanden_nidfurn_skating',
    klassischKey: 'schwanden_nidfurn_klassisch',
  },
  {
    key: 'nidfurn_leuggelbach',
    name: 'Nidfurn - Leuggelbach',
    skatingKey: 'nidfurn_leuggelbach_skating',
    klassischKey: 'nidfurn_leuggelbach_klassisch',
  },
  {
    key: 'rundkurs_leuggelbach',
    name: 'Rundkurs Leuggelbach',
    skatingKey: 'rundkurs_leuggelbach_skating',
    klassischKey: 'rundkurs_leuggelbach_klassisch',
  },
  {
    key: 'luchsingen_skistuebli',
    name: 'Luchsingen - Skistübli',
    skatingKey: 'luchsingen_skistuebli_skating',
    klassischKey: 'luchsingen_skistuebli_klassisch',
  },
  {
    key: 'haetzingen_linthal',
    name: 'Hätzingen - Linthal',
    skatingKey: 'haetzingen_linthal_skating',
    klassischKey: 'haetzingen_linthal_klassisch',
  },
  {
    key: 'saeatli_boden',
    name: 'Säätliboden (Rüti GL)',
    skatingKey: 'saeatli_boden_skating',
    klassischKey: 'saeatli_boden_klassisch',
  },
  {
    key: 'skilift_lo',
    name: 'Skilift Loh',
    skatingKey: 'skilift_lo_skating',
    klassischKey: 'skilift_lo_klassisch',
    hasSkipiste: true,
  },
];

type LoipenState = Record<string, boolean>;

export default function Loipen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loipenState, setLoipenState] = useState<LoipenState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  const fetchLoipenData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('loipen_protokoll')
      .select('*')
      .eq('user_id', user.id)
      .eq('datum', selectedDate)
      .maybeSingle();

    if (error) {
      console.error('Error fetching loipen:', error);
    }

    if (data) {
      setExistingId(data.id);
      const state: LoipenState = {};
      LOIPEN.forEach((loipe) => {
        state[loipe.skatingKey] = (data as Record<string, unknown>)[loipe.skatingKey] as boolean || false;
        state[loipe.klassischKey] = (data as Record<string, unknown>)[loipe.klassischKey] as boolean || false;
      });
      setLoipenState(state);
    } else {
      setExistingId(null);
      const initialState: LoipenState = {};
      LOIPEN.forEach((loipe) => {
        initialState[loipe.skatingKey] = false;
        initialState[loipe.klassischKey] = false;
      });
      setLoipenState(initialState);
    }
    setLoading(false);
  }, [user, selectedDate]);

  useEffect(() => {
    fetchLoipenData();
  }, [fetchLoipenData]);

  const toggleLoipe = (key: string) => {
    setLoipenState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleBoth = (loipe: LoipeConfig) => {
    const bothSelected = loipenState[loipe.skatingKey] && loipenState[loipe.klassischKey];
    setLoipenState((prev) => ({
      ...prev,
      [loipe.skatingKey]: !bothSelected,
      [loipe.klassischKey]: !bothSelected,
    }));
  };

  const toggleSkipiste = (loipe: LoipeConfig) => {
    // For Skilift Loh, toggle both skating and klassisch together as "Skipiste"
    const isSelected = loipenState[loipe.skatingKey] || loipenState[loipe.klassischKey];
    setLoipenState((prev) => ({
      ...prev,
      [loipe.skatingKey]: !isSelected,
      [loipe.klassischKey]: !isSelected,
    }));
  };

  const saveLoipen = async () => {
    if (!user) return;

    setSaving(true);

    const payload = {
      user_id: user.id,
      datum: selectedDate,
      ...loipenState,
    };

    let error;

    if (existingId) {
      const result = await supabase
        .from('loipen_protokoll')
        .update(payload)
        .eq('id', existingId);
      error = result.error;
    } else {
      const result = await supabase.from('loipen_protokoll').insert(payload);
      error = result.error;
    }

    setSaving(false);

    if (error) {
      toast({
        title: 'Fehler',
        description: 'Protokoll konnte nicht gespeichert werden',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Gespeichert',
      description: 'Loipen-Protokoll wurde aktualisiert',
    });
    fetchLoipenData();
  };

  const countSelected = () => {
    let count = 0;
    LOIPEN.forEach((loipe) => {
      if (loipe.hasSkipiste) {
        if (loipenState[loipe.skatingKey] || loipenState[loipe.klassischKey]) {
          count++;
        }
      } else {
        if (loipenState[loipe.skatingKey]) count++;
        if (loipenState[loipe.klassischKey]) count++;
      }
    });
    return count;
  };

  const hasAnySelected = Object.values(loipenState).some((v) => v);

  return (
    <AppLayout title="Loipen-Protokoll">
      <div className="space-y-6">
        {/* Date Picker */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="date" className="text-sm text-muted-foreground">
                  Datum
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="input-alpine mt-1"
                />
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Heute</p>
                <p className="font-medium">
                  {format(new Date(), 'EEEE', { locale: de })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loipen List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Präparierte Loipen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Laden...</p>
            ) : (
              <div className="space-y-4">
                {LOIPEN.map((loipe) => (
                  <div
                    key={loipe.key}
                    className="loipe-card p-4 rounded-lg border border-border bg-card"
                  >
                    <p className="font-medium mb-3">{loipe.name}</p>
                    {loipe.hasSkipiste ? (
                      // Skilift Loh - only Skipiste checkbox
                      <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`${loipe.key}_skipiste`}
                            checked={loipenState[loipe.skatingKey] || loipenState[loipe.klassischKey] || false}
                            onCheckedChange={() => toggleSkipiste(loipe)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <Label
                            htmlFor={`${loipe.key}_skipiste`}
                            className="text-sm cursor-pointer"
                          >
                            Skipiste
                          </Label>
                        </div>
                      </div>
                    ) : (
                      // Regular loipen - Skating, Klassisch, and Beides
                      <div className="flex gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={loipe.skatingKey}
                            checked={loipenState[loipe.skatingKey] || false}
                            onCheckedChange={() => toggleLoipe(loipe.skatingKey)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <Label
                            htmlFor={loipe.skatingKey}
                            className="text-sm cursor-pointer"
                          >
                            Skating
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={loipe.klassischKey}
                            checked={loipenState[loipe.klassischKey] || false}
                            onCheckedChange={() => toggleLoipe(loipe.klassischKey)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <Label
                            htmlFor={loipe.klassischKey}
                            className="text-sm cursor-pointer"
                          >
                            Klassisch
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`${loipe.key}_beides`}
                            checked={loipenState[loipe.skatingKey] && loipenState[loipe.klassischKey]}
                            onCheckedChange={() => toggleBoth(loipe)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <Label
                            htmlFor={`${loipe.key}_beides`}
                            className="text-sm cursor-pointer"
                          >
                            Beides
                          </Label>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button
          onClick={saveLoipen}
          disabled={saving || loading}
          className="w-full gap-2"
        >
          {saving ? (
            'Speichern...'
          ) : (
            <>
              <Save className="h-4 w-4" />
              Protokoll speichern
            </>
          )}
        </Button>

        {/* Summary */}
        {hasAnySelected && (
          <Card className="bg-success/10 border-success/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-success">
                <Check className="h-5 w-5" />
                <p className="font-medium">
                  {countSelected()} Loipen markiert
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
