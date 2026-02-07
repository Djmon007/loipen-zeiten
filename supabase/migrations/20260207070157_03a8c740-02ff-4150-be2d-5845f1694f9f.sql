-- Create kasse_tageskarten table for daily ticket sales tracking
CREATE TABLE public.kasse_tageskarten (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    datum date NOT NULL DEFAULT CURRENT_DATE,
    betrag numeric NOT NULL,
    beschreibung text,
    beleg_url text,
    beleg_filename text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kasse_tageskarten ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert their own kasse entries"
ON public.kasse_tageskarten
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own kasse entries"
ON public.kasse_tageskarten
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own kasse entries"
ON public.kasse_tageskarten
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all kasse entries"
ON public.kasse_tageskarten
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create tasks table for admin task management
CREATE TABLE public.tasks (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Only admins can manage tasks
CREATE POLICY "Admins can manage all tasks"
ON public.tasks
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (true);

-- Create loipen_config table for admin trail management  
CREATE TABLE public.loipen_config (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    has_skating boolean NOT NULL DEFAULT true,
    has_klassisch boolean NOT NULL DEFAULT true,
    has_skipiste boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loipen_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage loipen config
CREATE POLICY "Admins can manage loipen config"
ON public.loipen_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view loipen config"
ON public.loipen_config
FOR SELECT
TO authenticated
USING (true);

-- Insert default loipen configuration
INSERT INTO public.loipen_config (name, has_skating, has_klassisch, has_skipiste, sort_order) VALUES
('Schwanden - Nidfurn', true, true, false, 1),
('Nidfurn - Leuggelbach', true, true, false, 2),
('Rundkurs Leuggelbach', true, true, false, 3),
('Luchsingen - Skistübli', true, true, false, 4),
('Hätzingen - Linthal', true, true, false, 5),
('Säätliboden (Rüti GL)', true, true, false, 6),
('Skilift Loh', false, false, true, 7);

-- Insert default tasks (work types)
INSERT INTO public.tasks (name) VALUES
('Loipenpräparation'),
('Aufbau'),
('Abbau'),
('Verschiedenes');

-- Add UPDATE policies for diesel and expenses (enable editing)
CREATE POLICY "Users can update their own diesel entries"
ON public.diesel_entries
FOR UPDATE
USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loipen_config_updated_at
BEFORE UPDATE ON public.loipen_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();