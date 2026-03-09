-- =========================================
-- DEVICE CODE COUNTERS TABLE
-- Tracks the last-used sequential number
-- per device type per lab.  Numbers ONLY go
-- up – even after scrapping, the counter is
-- never decremented.
-- =========================================

CREATE TABLE IF NOT EXISTS public.device_code_counters (
    id         SERIAL PRIMARY KEY,
    lab_id     VARCHAR(50)  NOT NULL,
    device_type VARCHAR(50) NOT NULL,
    last_number INTEGER     NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP   DEFAULT now(),
    UNIQUE(lab_id, device_type)
);

GRANT ALL ON TABLE public.device_code_counters TO assetiq_user;
GRANT ALL ON SEQUENCE public.device_code_counters_id_seq TO assetiq_user;
