-- Create todos table
CREATE TABLE IF NOT EXISTS public.todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "todos_select_own" ON public.todos;
DROP POLICY IF EXISTS "todos_insert_own" ON public.todos;
DROP POLICY IF EXISTS "todos_update_own" ON public.todos;
DROP POLICY IF EXISTS "todos_delete_own" ON public.todos;

CREATE POLICY "todos_select_own"
  ON public.todos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "todos_insert_own"
  ON public.todos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "todos_update_own"
  ON public.todos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "todos_delete_own"
  ON public.todos FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS todos_user_id_idx ON public.todos(user_id);
CREATE INDEX IF NOT EXISTS todos_due_date_idx ON public.todos(due_date);
