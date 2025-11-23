import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useState } from 'react';

interface UserProfileProps {
  user: User;
}

export function UserProfile({ user }: UserProfileProps) {
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    console.log('Sign out button clicked');
    setSigningOut(true);
    try {
      console.log('Calling supabase.auth.signOut()');

      // Add timeout to prevent hanging
      const signOutPromise = supabase.auth.signOut({ scope: 'local' });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sign out timeout')), 5000)
      );

      const { error } = await Promise.race([signOutPromise, timeoutPromise]) as any;

      console.log('Sign out response:', { error });
      if (error) {
        console.error('Sign out error:', error);
        alert('Failed to sign out: ' + error.message);
      } else {
        console.log('Sign out successful');
      }
    } catch (err: any) {
      console.error('Sign out exception:', err);
      // Even if it times out, the user is likely signed out
      if (err.message === 'Sign out timeout') {
        console.log('Sign out timed out, reloading page...');
        window.location.reload();
      } else {
        alert('Failed to sign out');
      }
    } finally {
      console.log('Sign out finally block');
      setSigningOut(false);
    }
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
        disabled={signingOut}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: 'transparent',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          cursor: signingOut ? 'wait' : 'pointer',
          fontSize: '0.9rem',
          opacity: signingOut ? 0.6 : 1,
        }}
      >
        {signingOut ? 'Signing out...' : 'Sign Out'}
      </button>
    </div>
  );
}
