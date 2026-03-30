import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ulsbctviflidelbmakpd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsc2JjdHZpZmxpZGVsYm1ha3BkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjczNjEsImV4cCI6MjA5MDQwMzM2MX0.I_9oa8vYaBNXY0h6xcGbbG3g-MQgArJPYFPJUzYvecQ';
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});