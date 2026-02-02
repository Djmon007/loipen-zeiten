import { useState, useEffect, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Receipt, Upload, Camera, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Expense {
  id: string;
  datum: string;
  beschreibung: string | null;
  beleg_url: string | null;
  beleg_filename: string | null;
}

export default function Spesen() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [beschreibung, setBeschreibung] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchExpenses = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('datum', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching expenses:', error);
      return;
    }

    setExpenses(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/heic', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: 'Ungültiger Dateityp',
          description: 'Bitte JPEG, PNG oder PDF hochladen',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'Datei zu gross',
          description: 'Maximale Dateigrösse ist 10 MB',
          variant: 'destructive',
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const uploadExpense = async () => {
    if (!user || !selectedFile) return;

    setUploading(true);

    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('belege')
        .upload(fileName, selectedFile);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from('belege').getPublicUrl(fileName);

      // Save expense record
      const { error: dbError } = await supabase.from('expenses').insert({
        user_id: user.id,
        datum: selectedDate,
        beschreibung: beschreibung || null,
        beleg_url: urlData.publicUrl,
        beleg_filename: selectedFile.name,
      });

      if (dbError) {
        throw dbError;
      }

      // Reset form
      setSelectedFile(null);
      setBeschreibung('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';

      fetchExpenses();
      toast({
        title: 'Beleg hochgeladen',
        description: 'Spesen wurden erfasst',
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Fehler',
        description: 'Beleg konnte nicht hochgeladen werden',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppLayout title="Spesen">
      <div className="space-y-6">
        {/* Upload Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Beleg erfassen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label>Beschreibung (optional)</Label>
              <Textarea
                placeholder="z.B. Material, Restaurant..."
                value={beschreibung}
                onChange={(e) => setBeschreibung(e.target.value)}
                className="input-alpine resize-none"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Beleg</Label>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  Foto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Datei
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    if (cameraInputRef.current) cameraInputRef.current.value = '';
                  }}
                >
                  ✕
                </Button>
              </div>
            )}

            <Button
              onClick={uploadExpense}
              disabled={uploading || !selectedFile}
              className="w-full gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Hochladen...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Beleg speichern
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Expenses */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Letzte Belege</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Laden...</p>
            ) : expenses.length === 0 ? (
              <p className="text-muted-foreground text-sm">Keine Belege vorhanden</p>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {expense.beschreibung || expense.beleg_filename || 'Beleg'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(expense.datum), 'dd.MM.yyyy', { locale: de })}
                      </p>
                    </div>
                    {expense.beleg_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a
                          href={expense.beleg_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ansehen
                        </a>
                      </Button>
                    )}
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
