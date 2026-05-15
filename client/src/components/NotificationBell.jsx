import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, ExternalLink, ShoppingBag, TrendingDown, AlertCircle } from 'lucide-react';
import { Button }          from '@/components/ui/button';
import { Badge }           from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth }         from '@/hooks/useAuth';

const API_URL = '/api';

function getToken() { return localStorage.getItem('token') || ''; }

const TYPE_CONFIG = {
  watchlist_added: { icon: ShoppingBag, color: 'text-green-500',  label: 'Watchlist' },
  price_drop:      { icon: TrendingDown, color: 'text-blue-500',   label: 'Price Drop' },
  target_price:    { icon: AlertCircle,  color: 'text-orange-500', label: 'Target' },
  digest:          { icon: Bell,         color: 'text-purple-500', label: 'Digest' },
};

const NotificationBell = () => {
  const { user }          = useAuth();
  const [notifications,   setNotifications] = useState([]);
  const [open,            setOpen]          = useState(false);
  const [lastFetch,       setLastFetch]     = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const token = getToken();
    if (!token) return;
    try {
      const res  = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setNotifications(data);
        setLastFetch(Date.now());
      }
    } catch { /* silent */ }
  }, [user]);

  // Initial fetch + poll every 30 s
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Refresh when popover opens
  useEffect(() => {
    if (open && Date.now() - lastFetch > 5000) fetchNotifications();
  }, [open, lastFetch, fetchNotifications]);

  const unread = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${API_URL}/notifications/read-all`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* silent */ }
  };

  const markOneRead = async (id) => {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch { /* silent */ }
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1 text-[10px] flex items-center justify-center bg-destructive text-white">
              {unread > 99 ? '99+' : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-84 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div>
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unread > 0 && (
              <p className="text-[11px] text-muted-foreground">{unread} unread</p>
            )}
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={markAllRead}>
              <Check className="h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No notifications yet</p>
              <p className="text-xs mt-1 opacity-70">
                Add products to your watchlist to get alerts
              </p>
            </div>
          ) : (
            notifications.map(n => {
              const cfg  = TYPE_CONFIG[n.type] || TYPE_CONFIG.price_drop;
              const Icon = cfg.icon;
              return (
                <div
                  key={n._id}
                  className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/30 ${!n.read ? 'bg-primary/5' : ''}`}
                  onClick={() => markOneRead(n._id)}
                >
                  {/* Icon */}
                  <div className={`mt-0.5 shrink-0 ${cfg.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {!n.read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-foreground leading-snug">{n.message}</p>
                    {n.link && n.link !== '/watchlist' && (
                      <a
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
                        onClick={e => e.stopPropagation()}
                      >
                        View product <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>

                  {/* Time */}
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t bg-muted/20 text-center">
            <a href="/watchlist" className="text-xs text-primary hover:underline">
              Manage watchlist →
            </a>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
