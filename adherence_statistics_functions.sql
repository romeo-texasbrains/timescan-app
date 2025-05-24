-- Function to get adherence counts by status for a specific date
CREATE OR REPLACE FUNCTION get_adherence_counts_by_status(p_date DATE)
RETURNS TABLE (
  status TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aa.status::TEXT,
    COUNT(*)::BIGINT
  FROM 
    attendance_adherence aa
  WHERE 
    aa.date = p_date
  GROUP BY 
    aa.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
