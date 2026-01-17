-- ============================================================
-- Cleanup Expired Reservations RPC Function
-- ============================================================
-- 
-- RPC function per rilasciare automaticamente lo stock
-- degli ordini card_online scaduti (reserve_expires_at <= now()).
-- 
-- La funzione è completamente DB-side e usa now() di Postgres
-- per garantire confronti temporali affidabili e timezone-safe.
-- 
-- Comportamento:
-- 1. Seleziona ordini scaduti con filtri durissimi
-- 2. Per ogni ordine scaduto:
--    - Rilascia lo stock per tutti gli order_items
--    - Aggiorna l'ordine a cancelled, stock_reserved=false, reserve_expires_at=NULL
-- 3. Ritorna il numero di ordini processati
-- 
-- Idempotente: può essere chiamata più volte senza effetti collaterali.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_record RECORD;
    v_item_record RECORD;
    v_processed_count integer := 0;
    v_stock_released boolean;
BEGIN
    -- Seleziona ordini scaduti con filtri durissimi
    -- Usa now() di Postgres (UTC) per confronto temporale affidabile
    FOR v_order_record IN
        SELECT id
        FROM public.orders
        WHERE payment_method = 'card_online'
          AND payment_status = 'pending'
          AND status = 'pending'
          AND stock_reserved = true
          AND stock_committed = true
          AND reserve_expires_at IS NOT NULL
          AND reserve_expires_at <= now()  -- Confronto DB-side con now() UTC
        FOR UPDATE SKIP LOCKED  -- Evita deadlock con altre transazioni
    LOOP
        BEGIN
            -- Rilascia stock per tutti gli order_items di questo ordine
            FOR v_item_record IN
                SELECT product_id, quantity
                FROM public.order_items
                WHERE order_id = v_order_record.id
            LOOP
                -- Rilascia stock usando RPC atomica
                SELECT rpc_increment_stock(
                    v_item_record.product_id,
                    v_item_record.quantity
                ) INTO v_stock_released;
                
                -- Log warning se il rilascio fallisce (prodotto non trovato)
                IF NOT v_stock_released THEN
                    RAISE WARNING 'Failed to release stock for product_id % in order %', 
                        v_item_record.product_id, v_order_record.id;
                END IF;
            END LOOP;
            
            -- Aggiorna ordine: cancelled, stock_committed=false, stock_reserved=false, reserve_expires_at=NULL
            UPDATE public.orders
            SET 
                stock_committed = false,
                stock_reserved = false,
                reserve_expires_at = NULL,
                status = 'cancelled'
            WHERE id = v_order_record.id;
            
            v_processed_count := v_processed_count + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Log errore ma continua con gli altri ordini
                RAISE WARNING 'Error processing order %: %', 
                    v_order_record.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN v_processed_count;
END;
$$;

-- Commento per documentazione
COMMENT ON FUNCTION public.cleanup_expired_reservations() IS 
'Rilascia automaticamente lo stock degli ordini card_online scaduti. 
Usa now() di Postgres per confronti temporali affidabili e timezone-safe.
Ritorna il numero di ordini processati. Idempotente e sicura.';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
