-- Add index to optimize birthday queries on patients table
CREATE INDEX IF NOT EXISTS idx_patients_date_of_birth ON patients(date_of_birth);

-- Add index for appointment counting (for plan limits)
CREATE INDEX IF NOT EXISTS idx_appointments_user_date ON appointments(user_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at);
