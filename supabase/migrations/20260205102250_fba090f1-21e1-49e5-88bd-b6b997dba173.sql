-- Add betrag (amount) column to expenses table
ALTER TABLE public.expenses 
ADD COLUMN betrag numeric DEFAULT NULL;

-- Add Skilift Lo columns to loipen_protokoll
ALTER TABLE public.loipen_protokoll
ADD COLUMN skilift_lo_skating boolean DEFAULT false,
ADD COLUMN skilift_lo_klassisch boolean DEFAULT false;