import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const UpdatePassword = () => {
  const { resetPasswordWithToken, updatePassword, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token'); // present when coming from email link

  const isTokenReset = Boolean(resetToken);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]      = useState('');
  const [confirmPassword, setConfirmPassword]  = useState('');
  const [loading,         setLoading]          = useState(false);
  const [done,            setDone]             = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const pwd = isTokenReset ? newPassword : newPassword;
    if (!pwd || pwd.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (pwd !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (!isTokenReset && !currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }

    setLoading(true);
    let result;
    if (isTokenReset) {
      result = await resetPasswordWithToken(resetToken, pwd);
    } else {
      result = await updatePassword(currentPassword, pwd);
    }
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      setDone(true);
      toast.success('Password updated successfully!');
      setTimeout(() => navigate('/login'), 2500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="inline-flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl">🛒</span>
            <span className="text-xl font-bold">Fair<span className="text-primary">Buy</span></span>
          </Link>
          <CardTitle>{isTokenReset ? 'Set New Password' : 'Update Password'}</CardTitle>
          <CardDescription>
            {isTokenReset
              ? 'Enter a new password for your account'
              : 'Change your current account password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <p className="font-semibold">Password updated!</p>
              <p className="text-sm text-muted-foreground">Redirecting to login…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Only show "current password" field for logged-in update, not token reset */}
              {!isTokenReset && (
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Current Password"
                    className="w-full rounded-lg border bg-background px-10 py-2.5 outline-none ring-ring focus:ring-2"
                    required
                  />
                </div>
              )}
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New Password (min 6 chars)"
                  className="w-full rounded-lg border bg-background px-10 py-2.5 outline-none ring-ring focus:ring-2"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm New Password"
                  className="w-full rounded-lg border bg-background px-10 py-2.5 outline-none ring-ring focus:ring-2"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link to="/login" className="text-primary hover:underline">Back to Login</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UpdatePassword;
