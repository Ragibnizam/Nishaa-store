'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings } from '@/lib/types';

interface SettingsContextType {
  settings: Settings | null;
  loading: boolean;
  refresh: () => void;
}

const SettingsContext = createContext<SettingsContextType>({ settings: null, loading: true, refresh: () => {} });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('settings').select('*').maybeSingle();
    setSettings(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh: load }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
