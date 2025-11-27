'use client';
import { useEffect, useState } from 'react';
import type { PublicSettings } from './types';

const DEFAULTS: PublicSettings = {
    delivery: { base: 2.5, per_km: 0.8, free_over: 50, max_km: 10 },
    payments: { cash: true, card_on_delivery: true, card_online: false },
};

export function useSettings() {
    const [data, setData] = useState<PublicSettings>(DEFAULTS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch('/api/settings', { cache: 'no-store' });
                const json = await res.json();
                if (alive && json?.delivery) setData(json);
            } catch { }
            finally { if (alive) setLoading(false); }
        })();
        return () => { alive = false; };
    }, []);

    return { settings: data, loading };
}
