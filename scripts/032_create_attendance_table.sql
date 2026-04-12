-- Create attendance tracking table
CREATE TABLE IF NOT EXISTS public.attendance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
    session_date date NOT NULL,
    status text DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'cancelled')),
    payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "attendance_select_own"
    ON public.attendance FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "attendance_insert_own"
    ON public.attendance FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "attendance_update_own"
    ON public.attendance FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "attendance_delete_own"
    ON public.attendance FOR DELETE
    USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_patient_id ON public.attendance(patient_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_date ON public.attendance(session_date);
