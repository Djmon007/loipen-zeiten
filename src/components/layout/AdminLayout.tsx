import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Clock,
  MapPin,
  Fuel,
  Receipt,
  Download,
  LogOut,
  Menu,
  Users,
  ChevronRight,
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

const navItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/zeiterfassung', icon: Clock, label: 'Arbeitszeit' },
  { href: '/admin/loipen', icon: MapPin, label: 'Loipen-Protokoll' },
  { href: '/admin/diesel', icon: Fuel, label: 'Diesel' },
  { href: '/admin/spesen', icon: Receipt, label: 'Spesen' },
  { href: '/admin/mitarbeiter', icon: Users, label: 'Mitarbeiter' },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-primary">Loipe Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">Verwaltungspanel</p>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/admin' && location.pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User & Logout */}
      <div className="p-4 border-t border-border">
        {profile && (
          <div className="mb-3">
            <p className="text-sm font-medium">{profile.vorname} {profile.nachname}</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={signOut}
          className="w-full gap-2"
        >
          <LogOut className="h-4 w-4" />
          Abmelden
        </Button>
      </div>
    </div>
  );
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r border-border bg-card">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center gap-4 px-4 py-3 bg-card/95 backdrop-blur-md border-b border-border">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <NavContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-semibold">{title}</h1>
      </header>

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="hidden lg:block px-8 py-6 border-b border-border bg-card/50">
          <h1 className="text-2xl font-semibold">{title}</h1>
        </div>
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
