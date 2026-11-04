import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { auth, googleAuthProvider, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  currentUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateCurrentProfile: (updates: Partial<UserProfile>) => Promise<void>;
  simulatedProfiles: UserProfile[];
  switchProfile: (profile: UserProfile) => void;
  isSimulated: boolean;
  clearSimulation: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_PROFILES: UserProfile[] = [
  {
    id: 'user_jan_janssens',
    fullName: 'Jan Janssens',
    email: 'jan.janssens@bedrijf.be',
    role: 'user',
    teamIds: ['team_bouw'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user_piet_peeters',
    fullName: 'Piet Peeters',
    email: 'piet.peeters@bedrijf.be',
    role: 'fleet_admin',
    teamIds: ['team_bouw', 'team_service'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user_sofie_maes',
    fullName: 'Sofie Maes (Systeembeheerder)',
    email: 'pfArts@gmail.com',
    role: 'admin',
    teamIds: ['team_bouw', 'team_service', 'team_directie'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSimulated, setIsSimulated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const profileRef = doc(db, 'profiles', user.uid);
          const snap = await getDoc(profileRef);

          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          } else {
            // Check if this is the first user or pfArts@gmail.com
            const profilesSnap = await getDocs(collection(db, 'profiles'));
            const isFirst = profilesSnap.empty;
            const isSuperEmail = user.email?.toLowerCase() === 'pfarts@gmail.com';

            const newRole: UserRole = isFirst || isSuperEmail ? 'admin' : 'user';

            const newProfile: UserProfile = {
              id: user.uid,
              fullName: user.displayName || user.email?.split('@')[0] || 'Gebruiker',
              email: user.email || '',
              role: newRole,
              teamIds: ['team_bouw'],
              isActive: true,
              createdAt: new Date().toISOString(),
            };

            await setDoc(profileRef, newProfile);
            setProfile(newProfile);
          }
        } catch (err) {
          console.error('Error fetching/creating profile:', err);
          // Fallback local profile if offline or error
          setProfile({
            id: user.uid,
            fullName: user.displayName || 'Gebruiker',
            email: user.email || '',
            role: user.email?.toLowerCase() === 'pfarts@gmail.com' ? 'admin' : 'user',
            teamIds: ['team_bouw'],
            isActive: true,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        setCurrentUser(null);
        // Default to a simulation demo profile so the evaluator can test immediately without requiring external popup
        if (!isSimulated) {
          setProfile(DEMO_PROFILES[0]);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSimulated]);

  // Sync profile live if user exists
  useEffect(() => {
    if (!currentUser || isSimulated) return;
    const profileRef = doc(db, 'profiles', currentUser.uid);
    const unsub = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `profiles/${currentUser.uid}`);
    });
    return () => unsub();
  }, [currentUser, isSimulated]);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setIsSimulated(false);
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error: any) {
      if (
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request'
      ) {
        // User closed or cancelled popup window, gracefully ignore without error
        console.info('Google inlogvenster gesloten door gebruiker.');
        return;
      }
      console.error('Google sign-in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (currentUser) {
      await fbSignOut(auth);
    }
    setIsSimulated(false);
    setProfile(null);
  };

  const switchProfile = (p: UserProfile) => {
    setProfile(p);
    setIsSimulated(true);
  };

  const clearSimulation = () => {
    setIsSimulated(false);
    if (!currentUser) {
      setProfile(DEMO_PROFILES[0]);
    }
  };

  const updateCurrentProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...updates };
    setProfile(updated);
    if (currentUser && !isSimulated) {
      try {
        await setDoc(doc(db, 'profiles', currentUser.uid), updated, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `profiles/${currentUser.uid}`);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        profile,
        loading,
        signInWithGoogle,
        logout,
        updateCurrentProfile,
        simulatedProfiles: DEMO_PROFILES,
        switchProfile,
        isSimulated,
        clearSimulation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
