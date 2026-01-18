import { ReactNode } from "react";

interface MinimalLayoutProps {
  children: ReactNode;
  centered?: boolean;
  maxWidth?: "sm" | "md" | "lg";
}

export function MinimalLayout({ 
  children, 
  centered = false,
  maxWidth = "md" 
}: MinimalLayoutProps) {
  const maxWidthClasses = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <div 
        className={`min-h-screen ${
          centered 
            ? "flex flex-col items-center justify-center" 
            : "flex flex-col"
        }`}
      >
        <div className={`w-full ${maxWidthClasses[maxWidth]} mx-auto px-6 py-12`}>
          {children}
        </div>
      </div>
    </div>
  );
}
