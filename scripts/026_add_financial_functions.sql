CREATE OR REPLACE FUNCTION get_patient_financial_info(p_patient_id uuid)
RETURNS TABLE (
    total_paid numeric(10,2),
    total_due numeric(10,2),
    total_discounts numeric(10,2),
    attendance_rate numeric(5,2),
    payment_history jsonb
)
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Get the user_id associated with this patient
    SELECT user_id INTO v_user_id
    FROM patients
    WHERE id = p_patient_id;

    RETURN QUERY
    WITH payment_stats AS (
        SELECT
            COALESCE(SUM(CASE WHEN status = 'paid' THEN amount - COALESCE(discount, 0) END), 0) as paid,
            COALESCE(SUM(CASE WHEN status IN ('pending', 'overdue') THEN amount - COALESCE(discount, 0) END), 0) as due,
            COALESCE(SUM(CASE WHEN status = 'paid' THEN COALESCE(discount, 0) END), 0) as discounts,
            jsonb_agg(
                jsonb_build_object(
                    'id', id,
                    'amount', amount,
                    'discount', discount,
                    'status', status,
                    'payment_date', payment_date,
                    'due_date', due_date,
                    'notes', notes
                ) ORDER BY payment_date DESC
            ) as history
        FROM payments
        WHERE patient_id = p_patient_id
        AND user_id = v_user_id
    ),
    attendance_stats AS (
        SELECT
            CASE
                WHEN COUNT(*) > 0 THEN
                    (COUNT(CASE WHEN paid = true THEN 1 END)::numeric / COUNT(*)::numeric * 100)
                ELSE 0
            END as attendance_rate
        FROM financial_sessions
        WHERE patient_id = p_patient_id
        AND user_id = v_user_id
    )
    SELECT
        ps.paid as total_paid,
        ps.due as total_due,
        ps.discounts as total_discounts,
        ast.attendance_rate,
        COALESCE(ps.history, '[]'::jsonb) as payment_history
    FROM payment_stats ps
    CROSS JOIN attendance_stats ast;
END;
$$ LANGUAGE plpgsql;
