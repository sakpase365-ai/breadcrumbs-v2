import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, User, Globe, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex h-14 items-center justify-between">
            {/* Logo / Home */}
            <Link 
              to={profile?.role === "creator" ? "/creator" : "/recipient"} 
              className="flex items-center gap-2 text-sm font-light uppercase tracking-widest text-foreground hover:text-muted-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Breadcrumbs
            </Link>

            {/* User Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-0">
                <SheetHeader className="p-6 pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <SheetTitle className="text-base font-semibold">
                        {profile?.name || "User"}
                      </SheetTitle>
                      <p className="text-sm text-muted-foreground">
                        {profile?.email}
                      </p>
                    </div>
                  </div>
                </SheetHeader>
                
                <div className="py-2">
                  <button
                    onClick={() => navigate(profile?.role === "creator" ? "/creator/profile" : "/settings")}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Profile</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  
                  <button
                    onClick={() => navigate("/settings")}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Settings</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  
                  <button
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Breadcrumbs Language</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  
                  <div className="my-2 mx-6 border-t border-border" />
                  
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors text-destructive"
                  >
                    <div className="flex items-center gap-3">
                      <LogOut className="w-5 h-5" />
                      <span className="text-sm font-medium">Logout</span>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        <div className="max-w-4xl mx-auto px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
