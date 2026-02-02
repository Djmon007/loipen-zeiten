-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'worker');

-- Create enum for work types (Projekte)
CREATE TYPE public.work_type AS ENUM ('Loipenpräparation', 'Aufbau', 'Abbau', 'Verschiedenes');

-- Create enum for diesel tanks
CREATE TYPE public.diesel_tank AS ENUM ('Tank Nidfurn', 'Tank Hätzingen');

-- Create profiles table for user data
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    vorname TEXT NOT NULL,
    nachname TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'worker',
    UNIQUE (user_id, role)
);

-- Create time_entries table for Zeiterfassung
CREATE TABLE public.time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    datum DATE NOT NULL DEFAULT CURRENT_DATE,
    arbeit work_type NOT NULL,
    start_zeit TIME,
    stopp_zeit TIME,
    total_stunden NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create loipen_protokoll table for prepared trails
CREATE TABLE public.loipen_protokoll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    datum DATE NOT NULL DEFAULT CURRENT_DATE,
    time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE SET NULL,
    -- Schwanden-Nidfurn
    schwanden_nidfurn_skating BOOLEAN DEFAULT false,
    schwanden_nidfurn_klassisch BOOLEAN DEFAULT false,
    -- Nidfurn-Leuggelbach
    nidfurn_leuggelbach_skating BOOLEAN DEFAULT false,
    nidfurn_leuggelbach_klassisch BOOLEAN DEFAULT false,
    -- Rundkurs Leuggelbach
    rundkurs_leuggelbach_skating BOOLEAN DEFAULT false,
    rundkurs_leuggelbach_klassisch BOOLEAN DEFAULT false,
    -- Luchsingen-Skistübli
    luchsingen_skistuebli_skating BOOLEAN DEFAULT false,
    luchsingen_skistuebli_klassisch BOOLEAN DEFAULT false,
    -- Hätzingen-Linthal
    haetzingen_linthal_skating BOOLEAN DEFAULT false,
    haetzingen_linthal_klassisch BOOLEAN DEFAULT false,
    -- Säätliboden
    saeatli_boden_skating BOOLEAN DEFAULT false,
    saeatli_boden_klassisch BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create diesel_entries table for fuel tracking
CREATE TABLE public.diesel_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    datum DATE NOT NULL DEFAULT CURRENT_DATE,
    tank diesel_tank NOT NULL,
    liter NUMERIC(6,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expenses table for Spesen
CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE SET NULL,
    datum DATE NOT NULL DEFAULT CURRENT_DATE,
    beschreibung TEXT,
    beleg_url TEXT,
    beleg_filename TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loipen_protokoll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diesel_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Time entries policies
CREATE POLICY "Users can view their own time entries"
ON public.time_entries FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own time entries"
ON public.time_entries FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time entries"
ON public.time_entries FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time entries"
ON public.time_entries FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all time entries"
ON public.time_entries FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Loipen protokoll policies
CREATE POLICY "Users can view their own loipen protokoll"
ON public.loipen_protokoll FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own loipen protokoll"
ON public.loipen_protokoll FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own loipen protokoll"
ON public.loipen_protokoll FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all loipen protokoll"
ON public.loipen_protokoll FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Diesel entries policies
CREATE POLICY "Users can view their own diesel entries"
ON public.diesel_entries FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own diesel entries"
ON public.diesel_entries FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all diesel entries"
ON public.diesel_entries FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Expenses policies
CREATE POLICY "Users can view their own expenses"
ON public.expenses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own expenses"
ON public.expenses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses"
ON public.expenses FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all expenses"
ON public.expenses FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for expense receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('belege', 'belege', false);

-- Storage policies for receipts
CREATE POLICY "Users can upload their own receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'belege' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'belege' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'belege' AND public.has_role(auth.uid(), 'admin'));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at
    BEFORE UPDATE ON public.time_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, vorname, nachname)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'vorname', ''),
        COALESCE(NEW.raw_user_meta_data->>'nachname', '')
    );
    
    -- By default, new users are workers
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'worker');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();