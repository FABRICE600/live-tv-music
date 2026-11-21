import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthReady: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncUserDocuments(firebaseUser: User) {
  const uid = firebaseUser.uid;
  const displayName = (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Soundmark Listener').slice(0, 80);
  const photoUrl = firebaseUser.photoURL ? firebaseUser.photoURL.slice(0, 512) : undefined;
  const email = (firebaseUser.email || '').slice(0, 254);

  if (firebaseUser.emailVerified) {
    const publicPath = `users/${uid}`;
    try {
      const publicRef = doc(db, 'users', uid);
      const snap = await getDoc(publicRef);
      if (!snap.exists()) {
        await setDoc(publicRef, {
          ownerUid: uid,
          displayName,
          ...(photoUrl ? { photoUrl } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(publicRef, {
          displayName,
          ...(photoUrl ? { photoUrl } : {}),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, publicPath);
    }

    if (email.length >= 3) {
      const privatePath = `users/${uid}/private/info`;
      try {
        const privateRef = doc(db, 'users', uid, 'private', 'info');
        const privSnap = await getDoc(privateRef);
        if (!privSnap.exists()) {
          await setDoc(privateRef, {
            ownerUid: uid,
            email,
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(privateRef, {
            email,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, privatePath);
      }
    }
  }

  try {
    const token = await firebaseUser.getIdToken();
    await fetch('/api/sql/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        displayName,
        photoUrl: photoUrl || null,
      }),
    });
  } catch {
    // Non-blocking SQL profile sync
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setIsAuthReady(true);
      setLoading(false);
      if (nextUser) {
        try {
          await syncUserDocuments(nextUser);
        } catch {
          // Handled inside sync helper
        }
      }
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in';
      if (!message.includes('popup-closed-by-user')) {
        setAuthError(message);
      }
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign out');
    }
  }, []);

  const getIdToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthReady,
        authError,
        signInWithGoogle,
        signOutUser,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
