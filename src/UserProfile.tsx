import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface UserProfileProps {
  user: User;
}

export function UserProfile({ user }: UserProfileProps) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '0.5rem 1rem',
      backgroundColor: 'var(--color-bg-secondary)',
      borderRadius: '8px',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>
          {user.email}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
          Progress synced to cloud
        </div>
      </div>
      <button
        onClick={handleSignOut}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: 'transparent',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.9rem',
        }}
      >
        Sign Out
      </button>
    </div>
  );
}
