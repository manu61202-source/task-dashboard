// TaskFlow — Module d'authentification
// Charge AVANT le script Babel principal. Expose window.TaskFlowAuth.
//
// Contient :
//   - authService : wrapper autour de supabase.auth (signUp, signIn, signOut, updateUserPassword, requestPasswordReset)
//   - useAuthSession : hook React qui suit la session active
//   - AuthScreen : écran login/signup/reset avec clavier numérique pour le PIN
//   - PasswordChangeModal : modal pour changer son PIN (utilisé depuis le menu paramètres)

(function() {
    const { useState, useEffect, useRef } = React;
    const supabase = window.SUPABASE_CLIENT;

    // ============================================================
    // AUTH SERVICE — wraps supabase.auth
    // ============================================================
    const authService = {
        async signUp(email, pin) {
            const { data, error } = await supabase.auth.signUp({
                email: email.trim().toLowerCase(),
                password: pin,
            });
            return { data, error };
        },

        async signIn(email, pin) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password: pin,
            });
            return { data, error };
        },

        async signOut() {
            const { error } = await supabase.auth.signOut();
            return { error };
        },

        async updateUserPassword(newPin) {
            const { error } = await supabase.auth.updateUser({ password: newPin });
            return { error };
        },

        async requestPasswordReset(email) {
            const { error } = await supabase.auth.resetPasswordForEmail(
                email.trim().toLowerCase(),
                { redirectTo: window.location.origin + window.location.pathname }
            );
            return { error };
        },

        async getSession() {
            const { data } = await supabase.auth.getSession();
            return data.session;
        },
    };

    // ============================================================
    // useAuthSession HOOK
    // ============================================================
    function useAuthSession() {
        const [session, setSession] = useState(null);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            supabase.auth.getSession().then(({ data }) => {
                setSession(data.session);
                setLoading(false);
            });
            const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
                setSession(sess);
            });
            return () => listener.subscription.unsubscribe();
        }, []);

        return { session, loading };
    }

    // ============================================================
    // PIN KEYPAD (composant réutilisable)
    // ============================================================
    function PinKeypad({ pin, onKey, onBackspace, error }) {
        return (
            <React.Fragment>
                <div className="pin-dots">
                    {[0,1,2,3,4,5].map(i => (
                        <div key={i} className={`pin-dot ${i < pin.length ? (error ? 'error filled' : 'filled') : ''}`} />
                    ))}
                </div>
                <div className="pin-keypad">
                    {[1,2,3,4,5,6,7,8,9].map(n => (
                        <button key={n} type="button" className="pin-key" onClick={() => onKey(String(n))}>{n}</button>
                    ))}
                    <div className="pin-key empty" />
                    <button type="button" className="pin-key" onClick={() => onKey('0')}>0</button>
                    <button type="button" className="pin-key backspace" onClick={onBackspace}>&#9003;</button>
                </div>
            </React.Fragment>
        );
    }

    // ============================================================
    // AUTH SCREEN — login / signup / reset
    // ============================================================
    function AuthScreen({ Logo }) {
        const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset' | 'check_email_signup' | 'check_email_reset'
        const [email, setEmail] = useState('');
        const [pin, setPin] = useState('');
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState('');
        const [shake, setShake] = useState(false);

        const reset = () => { setPin(''); setError(''); setShake(false); };

        const handleKey = (digit) => {
            if (busy || pin.length >= 6) return;
            setError('');
            setPin(prev => prev + digit);
        };
        const handleBackspace = () => { if (!busy) setPin(prev => prev.slice(0, -1)); };

        useEffect(() => {
            const h = (e) => {
                if (mode === 'reset') return;
                // Si l'utilisateur tape dans un champ texte (email), ne pas intercepter — sinon
                // les chiffres saisis dans l'email s'ajoutent aussi au PIN.
                const tag = e.target?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
                if (e.key >= '0' && e.key <= '9') handleKey(e.key);
                if (e.key === 'Backspace') handleBackspace();
            };
            window.addEventListener('keydown', h);
            return () => window.removeEventListener('keydown', h);
        }, [mode, busy, pin]);

        const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

        const submit = async () => {
            if (busy) return;
            if (!validateEmail(email)) { setError('Email invalide'); return; }
            if ((mode === 'login' || mode === 'signup') && pin.length !== 6) {
                setError('Le PIN doit faire 6 chiffres'); setShake(true); setTimeout(() => setShake(false), 400); return;
            }
            setBusy(true);
            try {
                if (mode === 'login') {
                    const { error } = await authService.signIn(email, pin);
                    if (error) {
                        if (error.message?.toLowerCase().includes('email not confirmed')) {
                            setError('Tu dois confirmer ton email avant de te connecter');
                        } else {
                            setError('Email ou PIN incorrect');
                        }
                        setShake(true); setTimeout(() => setShake(false), 400); reset();
                    }
                    // Si OK, le hook useAuthSession met à jour la session automatiquement
                } else if (mode === 'signup') {
                    const { error } = await authService.signUp(email, pin);
                    if (error) {
                        setError(error.message || 'Erreur lors de la création du compte');
                    } else {
                        setMode('check_email_signup');
                    }
                } else if (mode === 'reset') {
                    const { error } = await authService.requestPasswordReset(email);
                    if (error) setError(error.message);
                    else setMode('check_email_reset');
                }
            } finally {
                setBusy(false);
            }
        };

        // Auto-submit en login/signup quand le PIN atteint 6 chiffres
        useEffect(() => {
            if (pin.length === 6 && (mode === 'login' || mode === 'signup') && validateEmail(email) && !busy) {
                submit();
            }
        }, [pin]);

        if (mode === 'check_email_signup' || mode === 'check_email_reset') {
            return (
                <div className="pin-container">
                    <div className="pin-card">
                        <div className="pin-logo">{Logo ? <Logo size={44} /> : null}</div>
                        <div style={{ fontSize: 48, marginTop: 8, marginBottom: 8 }}>📩</div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                            {mode === 'check_email_signup' ? 'Vérifie ta boîte mail' : 'Email envoyé'}
                        </h2>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 24 }}>
                            {mode === 'check_email_signup'
                                ? <>On vient d'envoyer un lien de confirmation à <strong>{email}</strong>. Clique-le pour activer ton compte, puis reviens te connecter.</>
                                : <>Si ce compte existe, un lien de réinitialisation a été envoyé à <strong>{email}</strong>.</>
                            }
                        </div>
                        <button type="button" className="btn-submit" style={{ width: '100%' }} onClick={() => { setMode('login'); reset(); setEmail(''); }}>
                            Retour à la connexion
                        </button>
                    </div>
                </div>
            );
        }

        const isLogin = mode === 'login';
        const isSignup = mode === 'signup';
        const isReset = mode === 'reset';

        return (
            <div className="pin-container">
                <div className={`pin-card ${shake ? 'pin-shake' : ''}`}>
                    <div className="pin-logo">{Logo ? <Logo size={44} /> : null}</div>
                    <div className="pin-subtitle">
                        {isLogin && 'Connecte-toi pour accéder à tes tâches'}
                        {isSignup && 'Crée ton compte (email + PIN à 6 chiffres)'}
                        {isReset && 'Réinitialise ton PIN par email'}
                    </div>

                    <input
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="ton@email.com"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setError(''); }}
                        className="form-input"
                        style={{ marginBottom: 32 }}
                        disabled={busy}
                    />

                    {!isReset && (
                        <PinKeypad pin={pin} onKey={handleKey} onBackspace={handleBackspace} error={!!error && shake} />
                    )}

                    {isReset && (
                        <button
                            type="button"
                            className="btn-submit"
                            style={{ width: '100%', marginTop: 4 }}
                            onClick={submit}
                            disabled={busy || !validateEmail(email)}
                        >
                            {busy ? 'Envoi...' : 'Envoyer le lien'}
                        </button>
                    )}

                    {isSignup && (
                        <button
                            type="button"
                            className="btn-submit"
                            style={{ width: '100%', marginTop: 16 }}
                            onClick={submit}
                            disabled={busy || pin.length !== 6 || !validateEmail(email)}
                        >
                            {busy ? 'Création...' : 'Créer mon compte'}
                        </button>
                    )}

                    <div className="pin-error-msg">{error}</div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, fontSize: 13 }}>
                        {isLogin && (
                            <React.Fragment>
                                <button type="button" onClick={() => { setMode('signup'); reset(); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                                    Pas encore de compte ? Créer un compte
                                </button>
                                <button type="button" onClick={() => { setMode('reset'); reset(); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
                                    PIN oublié ?
                                </button>
                            </React.Fragment>
                        )}
                        {(isSignup || isReset) && (
                            <button type="button" onClick={() => { setMode('login'); reset(); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                                ← Déjà un compte ? Se connecter
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ============================================================
    // PASSWORD CHANGE MODAL — change son PIN connecté
    // ============================================================
    function PasswordChangeModal({ onClose, onChanged }) {
        const [newPin, setNewPin] = useState('');
        const [confirm, setConfirm] = useState('');
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState('');

        const handleSubmit = async (e) => {
            e.preventDefault();
            if (newPin.length !== 6) { setError('Le PIN doit faire 6 chiffres'); return; }
            if (newPin !== confirm) { setError('Les PIN ne correspondent pas'); return; }
            setBusy(true);
            const { error } = await authService.updateUserPassword(newPin);
            setBusy(false);
            if (error) { setError(error.message || 'Erreur'); return; }
            onChanged?.();
            onClose();
        };

        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
                    <div className="modal-handle" />
                    <h2>Changer le PIN</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Nouveau PIN (6 chiffres)</label>
                            <input
                                className="pin-change-input" type="tel" maxLength={6}
                                inputMode="numeric" pattern="[0-9]*"
                                value={newPin}
                                onChange={e => { setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                                placeholder="••••••" autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirmer</label>
                            <input
                                className="pin-change-input" type="tel" maxLength={6}
                                inputMode="numeric" pattern="[0-9]*"
                                value={confirm}
                                onChange={e => { setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                                placeholder="••••••"
                            />
                        </div>
                        {error && <div style={{ color: 'var(--critique)', fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{error}</div>}
                        <div className="modal-btns">
                            <button type="button" className="btn-cancel" onClick={onClose} disabled={busy}>Annuler</button>
                            <button type="submit" className="btn-submit" disabled={busy}>{busy ? 'Sauvegarde...' : 'Enregistrer'}</button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    window.TaskFlowAuth = { authService, useAuthSession, AuthScreen, PasswordChangeModal };
})();
